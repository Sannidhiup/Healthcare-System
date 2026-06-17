from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from datetime import date as date_type
from typing import List
import os, uuid, re, io
import google.generativeai as genai
from pypdf import PdfReader
from supabase import create_client

import models, schemas
from database import get_db
from dependencies import get_current_user

router = APIRouter(prefix="/patient", tags=["Patient Operations"])

# --- SUPABASE & AI ---
BUCKET_NAME = "hospital-patient-records"
supabase = create_client(os.getenv("SUPABASE_URL", "https://yicilvfuyfzsbbjmnrqc.supabase.co"), os.getenv("SUPABASE_KEY", ""))
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
embed_model = 'models/gemini-embedding-001'

class DirectBookRequest(schemas.BaseModel): slot_id: int
class RescheduleRequest(schemas.BaseModel): new_slot_id: int

@router.get("/appointments")
def get_patient_bookings(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "PATIENT": raise HTTPException(403, "Patients only")
    patient = db.query(models.Patient).filter_by(user_id=current_user["user_id"]).first()
    if not patient: raise HTTPException(404, "Profile not found")
        
    expired = db.query(models.Appointment).filter(models.Appointment.patient_id == patient.id, models.Appointment.appointment_date < date_type.today(), models.Appointment.status.in_(["SCHEDULED", "CONFIRMED"])).all()
    if expired:
        for b in expired: b.status = "CANCELLED" 
        db.commit() 

    bookings = db.query(models.Appointment).options(
        joinedload(models.Appointment.slot).joinedload(models.DoctorSlot.doctor).joinedload(models.Doctor.user)
    ).filter_by(patient_id=patient.id).all()

    return [{"id": b.id, "doctor_id": b.slot.doctor_id if b.slot else None, "doctor_name": b.slot.doctor.user.name if b.slot and b.slot.doctor else "Unknown", "date": str(b.appointment_date), "start_time": b.slot.start_time if b.slot else "N/A", "end_time": b.slot.end_time if b.slot else "N/A", "status": b.status, "summary": b.appointment_summary} for b in bookings]

@router.post("/book")
def book_appointment(payload: DirectBookRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "PATIENT": raise HTTPException(403, "Patients only")
    patient = db.query(models.Patient).filter_by(user_id=current_user["user_id"]).first()
    slot = db.query(models.DoctorSlot).filter_by(id=payload.slot_id).first()
    if not slot or slot.is_booked: raise HTTPException(400, "Slot unavailable")
    
    slot.is_booked = True
    new_app = models.Appointment(patient_id=patient.id, doctor_id=slot.doctor_id, slot_id=slot.id, hospital_id=db.query(models.Doctor).filter_by(id=slot.doctor_id).first().hospital_id, appointment_date=slot.date, status="SCHEDULED")
    db.add(new_app)
    db.commit()
    return {"msg": "Booking confirmed", "appointment_id": new_app.id}

@router.put("/reschedule/{appointment_id}")
def reschedule_appointment(appointment_id: int, payload: RescheduleRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt or appt.status in ["COMPLETED", "CANCELLED"]: raise HTTPException(400, "Cannot reschedule")
    new_slot = db.query(models.DoctorSlot).filter(models.DoctorSlot.id == payload.new_slot_id).first()
    if not new_slot or new_slot.is_booked: raise HTTPException(400, "Slot unavailable")
    
    old_slot = db.query(models.DoctorSlot).filter(models.DoctorSlot.id == appt.slot_id).first()
    if old_slot: old_slot.is_booked = False
    
    new_slot.is_booked, appt.slot_id, appt.appointment_date, appt.status = True, payload.new_slot_id, new_slot.date, "SCHEDULED"
    db.commit()
    return {"status": "Success", "msg": "Reschedule complete."}

@router.put("/cancel/{id}")
def cancel_appointment(id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    appt = db.query(models.Appointment).filter_by(id=id).first()
    if not appt or appt.status in ["COMPLETED", "CANCELLED"]: raise HTTPException(400, "Cannot cancel")
    slot = db.query(models.DoctorSlot).filter_by(id=appt.slot_id).first()
    if slot: slot.is_booked = False
    appt.status = "CANCELLED"
    db.commit()
    return {"msg": "Appointment cancelled."}

@router.post("/upload-records")
async def upload_records(appointment_id: str = Form(...), files: List[UploadFile] = File(...), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "PATIENT": raise HTTPException(403, "Patients only")
    try:
        user = db.query(models.User).filter_by(id=current_user["user_id"]).first()
        patient = db.query(models.Patient).filter_by(user_id=current_user["user_id"]).first()
        urls = []
        for file in files:
            f_bytes = await file.read()
            c_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', file.filename)
            path = f"patient_{user.email}/appt_{appointment_id}_{uuid.uuid4()}_{c_name}"
            supabase.storage.from_(BUCKET_NAME).upload(path=path, file=f_bytes, file_options={"content-type": "application/pdf", "upsert": "true"})
            urls.append(supabase.storage.from_(BUCKET_NAME).get_public_url(path))
            
            # AI Embedding
            reader = PdfReader(io.BytesIO(f_bytes))
            full_text = "\n".join([p.extract_text() or "" for p in reader.pages])
            chunks = [full_text[i:i+1000] for i in range(0, len(full_text), 1000)]
            for chunk in chunks:
                if len(chunk.strip()) > 10:
                    embed = genai.embed_content(model=embed_model, content=chunk, task_type="retrieval_document")['embedding']
                    supabase.table("patient_documents").insert({"patient_id": patient.id, "content": chunk, "embedding": embed}).execute()
        return {"status": "success", "urls": urls}
    except Exception as e: print(e); raise HTTPException(500, "Upload failed.")

@router.get("/my-documents")
def get_documents(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "PATIENT": raise HTTPException(403, "Patients only")
    user = db.query(models.User).filter_by(id=current_user["user_id"]).first()
    folder = f"patient_{user.email}"
    try:
        files = supabase.storage.from_(BUCKET_NAME).list(folder)
        return [{"id": f.get('id', f"{folder}/{f['name']}"), "name": re.sub(r'^appt_\d+_[a-f0-9\-]+_', '', f['name']), "url": supabase.storage.from_(BUCKET_NAME).get_public_url(f"{folder}/{f['name']}"), "path": f"{folder}/{f['name']}"} for f in files if f['name'] != '.emptyFolderPlaceholder']
    except: return []

@router.delete("/document")
def delete_document(file_path: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "PATIENT": raise HTTPException(403, "Patients only")
    user = db.query(models.User).filter_by(id=current_user["user_id"]).first()
    if not file_path.startswith(f"patient_{user.email}/"): raise HTTPException(403, "Unauthorized")
    try: supabase.storage.from_(BUCKET_NAME).remove([file_path]); return {"msg": "Deleted"}
    except: raise HTTPException(500, "Delete failed")