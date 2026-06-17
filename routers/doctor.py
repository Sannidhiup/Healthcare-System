from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import date as date_type
import os
import google.generativeai as genai
from supabase import create_client

import models, schemas
from database import get_db
from dependencies import get_current_user

router = APIRouter(prefix="/doctor", tags=["Doctor Operations"])

# --- AI SETUP ---
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
embed_model = 'models/gemini-embedding-001'
chat_model = genai.GenerativeModel('gemini-2.5-flash')
supabase = create_client(os.getenv("SUPABASE_URL", "https://yicilvfuyfzsbbjmnrqc.supabase.co"), os.getenv("SUPABASE_KEY", ""))

class StatusUpdateRequest(schemas.BaseModel): status: str
class SummaryRequest(schemas.BaseModel): summary: str
class ChatRequest(schemas.BaseModel): patient_id: int; question: str; doctor_name: str = "Doctor"

@router.get("/my-schedule")
def get_doctor_schedule(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "DOCTOR": raise HTTPException(403, "Access restricted to Doctors only")
    doctor = db.query(models.Doctor).filter_by(user_id=current_user["user_id"]).first()
    if not doctor: raise HTTPException(404, "Profile not found")
    
    schedule = db.query(models.Appointment).options(
        joinedload(models.Appointment.patient).joinedload(models.Patient.user),
        joinedload(models.Appointment.slot)
    ).filter_by(doctor_id=doctor.id).all()

    return [{"id": a.id, "patient_id": a.patient_id, "patient_name": a.patient.user.name if a.patient and a.patient.user else "Unknown Patient", "date": a.appointment_date, "time": f"{a.slot.start_time} - {a.slot.end_time}" if a.slot else "N/A", "status": a.status, "summary": a.appointment_summary} for a in schedule]

@router.put("/appointment/{appointment_id}/status")
def update_appointment_status(appointment_id: int, payload: StatusUpdateRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "DOCTOR": raise HTTPException(403, "Only doctors can update live status")
    appt = db.query(models.Appointment).filter_by(id=appointment_id).first()
    if not appt: raise HTTPException(404, "Appointment not found")
    if appt.status == "COMPLETED" and payload.status != "COMPLETED": raise HTTPException(400, "Cannot change status of a completed appointment")
    appt.status = payload.status
    db.commit()
    return {"msg": f"Status updated to {payload.status}"}

@router.put("/appointment/{appointment_id}/summary")
def save_appointment_summary(appointment_id: int, payload: SummaryRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "DOCTOR": raise HTTPException(403, "Only doctors can write summaries")
    appt = db.query(models.Appointment).filter_by(id=appointment_id).first()
    if not appt: raise HTTPException(404, "Appointment not found")
    appt.appointment_summary, appt.status = payload.summary, "COMPLETED" 
    db.commit()
    return {"msg": "Clinical summary saved and appointment completed."}

@router.post("/chat")
def doctor_ai_chat(payload: ChatRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.get("role") != "DOCTOR": raise HTTPException(403, "Only doctors can access the AI")
    try:
        patient = db.query(models.Patient).filter_by(id=payload.patient_id).first()
        if not patient: return {"answer": "Cannot locate this patient's database record."}
        
        db_context = f"Patient Name: {patient.user.name}\nAge: {patient.age}, Gender: {patient.gender}, Blood Group: {patient.blood_group}\n\nAppointment History:\n"
        appointments = db.query(models.Appointment).filter_by(patient_id=payload.patient_id).all()
        if not appointments: db_context += "No previous appointments.\n"
        else:
            for appt in appointments:
                doc_name = appt.doctor.user.name if appt.doctor and appt.doctor.user else "Unknown"
                time_window = f"{appt.slot.start_time} to {appt.slot.end_time}" if appt.slot else "Unknown Time"
                db_context += f"- Date: {appt.appointment_date} | Time: {time_window} | Status: {appt.status} | Seen by: Dr. {doc_name} | Notes: {appt.appointment_summary}\n"

        q_embed = genai.embed_content(model=embed_model, content=payload.question, task_type="retrieval_query")['embedding']
        search_results = supabase.rpc("match_documents", {"query_embedding": q_embed, "match_threshold": 0.2, "match_count": 5, "p_id": payload.patient_id}).execute()
        
        pdf_context = "No uploaded medical PDFs found."
        if search_results.data: pdf_context = "\n\n".join([item["content"] for item in search_results.data])

        prompt = f"""You are an intelligent, polite medical AI. 
        RULES: Maintain a warm tone. Answer using ONLY the Database and Document Context. 
        GREETING RULE: IF the doctor says a simple greeting, reply EXACTLY: 'Hello {payload.doctor_name}! How may I assist you today?'
        DIRECT ANSWER RULE: If asked a specific question, SKIP the greeting and answer directly.
        --- DATABASE --- {db_context}
        --- DOCUMENTS --- {pdf_context}
        Doctor's Input: {payload.question}"""

        return {"answer": chat_model.generate_content(prompt).text}
    except Exception as e:
        print(f"AI Error: {e}")
        raise HTTPException(500, "AI Assistant error.")