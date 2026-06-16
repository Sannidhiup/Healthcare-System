from fastapi import FastAPI, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from database import Base, engine, SessionLocal
import models, schemas
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta, date as date_type
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import os
import uuid
import re
import random
from dotenv import load_dotenv
from datetime import timezone
from twilio.rest import Client

# Load the environment variables from the .env file
load_dotenv()

# --- NEW AI IMPORTS ---
import google.generativeai as genai
from pypdf import PdfReader
import io

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- JWT CONFIG ---------------- #
SECRET_KEY = "mysecretkey"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
security = HTTPBearer()

# ---------------- GEMINI AI CONFIG ---------------- #
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GOOGLE_API_KEY)

embed_model = 'models/gemini-embedding-001'
chat_model = genai.GenerativeModel('gemini-2.5-flash')

# ---------------- SUPABASE CLOUD STORAGE CONFIG ---------------- #
SUPABASE_URL = "https://yicilvfuyfzsbbjmnrqc.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
BUCKET_NAME = "hospital-patient-records"

# Create tables on startup
Base.metadata.create_all(bind=engine)

# ---------------- PASSWORD UTILS ---------------- #
pwd_context = CryptContext(schemes=["bcrypt"])

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str):
    return pwd_context.verify(plain, hashed)

# ---------------- TOKEN UTILS ---------------- #
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# ---------------- AUTH DEPENDENCY ---------------- #
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# ---------------- DATABASE DEPENDENCY ---------------- #
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------- REQUEST SCHEMAS FOR MODALS ---------------- #
class RescheduleRequest(BaseModel):
    new_slot_id: int

class DirectBookRequest(BaseModel):
    slot_id: int

class ChatRequest(BaseModel):
    patient_id: int
    question: str
    doctor_name: str = "Doctor"

class StatusUpdateRequest(BaseModel):
    status: str

class SummaryRequest(BaseModel):
    summary: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

@app.get("/")
def home():
    return {"message": "Hospital Management System API v3 (AI Integrated) is Online"}

# =========================================================
# ---------------- AUTH & REGISTRATION ---------------- #
# =========================================================

@app.post("/register")
def register(user: schemas.PatientCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(400, "Email already exists")
    
    new_user = models.User(
        name=user.name,
        email=user.email,
        password=hash_password(user.password),
        phone=user.phone,
        role=user.role.upper()
    )
    db.add(new_user)
    db.flush() 

    if new_user.role == "PATIENT":
        new_profile = models.Patient(
            user_id=new_user.id,
            age=user.age,
            gender=user.gender,
            blood_group=user.blood_group
        )
        db.add(new_profile)
    
    db.commit()
    return {"msg": f"{new_user.role} account created successfully!"}

@app.post("/login")
def login(data: schemas.LoginSchema, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not verify_password(data.password, user.password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    token = create_access_token({"user_id": user.id, "role": user.role})
    
    response_data = {
        "access_token": token, 
        "token_type": "bearer",
        "name": user.name, 
        "role": user.role,
        "extra_info": "" 
    }

    if user.role == "DOCTOR":
        doctor = db.query(models.Doctor).filter_by(user_id=user.id).first()
        if doctor:
            hospital = db.query(models.Hospital).filter_by(id=doctor.hospital_id).first()
            department = db.query(models.Department).filter_by(id=doctor.department_id).first()
            h_name = hospital.name if hospital else "Unknown Hospital"
            d_name = department.name if department else "Unknown Dept"
            response_data["extra_info"] = f"{d_name} | {h_name}"

    return response_data

@app.post("/forgot-password")
def request_password_reset(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    
    if not user or user.role != "PATIENT":
        return {"message": "If a patient account exists for this email, an OTP has been sent."}
    
    # 1. Generate the OTP and Expiration
    otp_code = str(random.randint(100000, 999999))
    from datetime import timezone
    expiration = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # 2. Save to Database
    user.reset_otp = otp_code
    user.reset_otp_expire = expiration
    db.commit()
    
    # ==========================================
    # 3. REAL TWILIO SMS INTEGRATION
    # ==========================================
    # Replace these with your actual Twilio console details
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_SID")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_TOKEN")
    TWILIO_PHONE_NUMBER = "+18604078159" # Your Twilio virtual number
    
    try:
        # Twilio requires country codes. If your DB numbers don't have +91, we add it here.
        patient_phone = str(user.phone)
        if not patient_phone.startswith("+"):
            patient_phone = f"+91{patient_phone}" # Change +91 if not in India
            
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        
        message = client.messages.create(
            body=f"Your Hospital Portal secure password reset code is: {otp_code}. Do not share this with anyone.",
            from_=TWILIO_PHONE_NUMBER,
            to=patient_phone
        )
        print(f"✅ Real SMS successfully sent to {patient_phone}. Twilio Message ID: {message.sid}")
        
    except Exception as e:
        print(f"❌ Twilio Failed to send SMS: {e}")
        # We don't crash the server here, just log the error so the user doesn't get a scary 500 error screen.
    
    return {"message": "If a patient account exists for this email, an OTP has been sent."}

@app.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    
    if not user or user.role != "PATIENT":
        raise HTTPException(status_code=400, detail="Invalid request.")
        
    if user.reset_otp != req.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP code.")
        
    if not user.reset_otp_expire or datetime.now(timezone.utc) > user.reset_otp_expire:
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")
        
    # Validation passed -> Update password
    user.password = hash_password(req.new_password)
    
    # Burn the OTP
    user.reset_otp = None
    user.reset_otp_expire = None
    
    db.commit()
    return {"message": "Password successfully reset!"}


# =========================================================
# ---------------- INFRASTRUCTURE APIs ---------------- #
# =========================================================
@app.post("/hospitals/bulk")
def create_multiple_hospitals(data: List[schemas.HospitalCreate], db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(403, "Admin only")
    for h_data in data:
        db.add(models.Hospital(**h_data.dict()))
    db.commit()
    return {"msg": f"Successfully created {len(data)} hospitals!"}

@app.put("/hospitals/{id}")
def update_hospital(id: int, data: schemas.HospitalCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(403, "Admin only")
    hospital = db.query(models.Hospital).filter_by(id=id).first()
    if not hospital:
        raise HTTPException(404, "Hospital not found")
    hospital.name, hospital.location = data.name, data.location
    db.commit()
    return {"msg": "Hospital updated successfully"}

@app.delete("/hospitals/{id}")
def delete_hospital(id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(403, "Admin only")
    hospital = db.query(models.Hospital).filter_by(id=id).first()
    if not hospital:
        raise HTTPException(404, "Hospital not found")
    db.delete(hospital) 
    db.commit()
    return {"msg": "Hospital and all related data removed."}

@app.post("/departments")
def create_department(data: schemas.DepartmentCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(403, "Admin only")
    new_dept = models.Department(name=data.name, hospital_id=data.hospital_id)
    db.add(new_dept)
    db.commit()
    db.refresh(new_dept)
    return {"msg": "Department created successfully", "id": new_dept.id}

@app.put("/departments/{id}")
def update_department(id: int, data: schemas.DepartmentCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(403, "Admin only")
    dept = db.query(models.Department).filter_by(id=id).first()
    if not dept:
        raise HTTPException(404, "Department not found")
    dept.name = data.name
    dept.hospital_id = data.hospital_id
    db.commit()
    return {"msg": "Department updated successfully"}

@app.delete("/departments/{id}")
def delete_department(id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(403, "Admin only")
    dept = db.query(models.Department).filter_by(id=id).first()
    if not dept:
        raise HTTPException(404, "Department not found")
    db.delete(dept)
    db.commit()
    return {"msg": "Department deleted successfully"}

# =========================================================
# ---------------- DOCTOR APIs ---------------- #
# =========================================================
@app.post("/doctors")
def create_doctor(data: schemas.DoctorCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(403, "Admin only")
    new_user = models.User(
        name=data.name, email=data.email, 
        password=hash_password(data.password), 
        phone=data.phone, role="DOCTOR"
    )
    db.add(new_user)
    db.flush()

    new_doctor = models.Doctor(
        user_id=new_user.id, specialization=data.specialization,
        years_of_experience=data.years_of_experience,
        hospital_id=data.hospital_id, department_id=data.department_id
    )
    db.add(new_doctor)
    db.commit()
    return {"msg": f"Doctor {new_user.name} registered."}

@app.put("/doctors/{id}")
def update_doctor(id: int, data: schemas.DoctorCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(403, "Admin only")
    doctor = db.query(models.Doctor).filter_by(id=id).first()
    if not doctor:
        raise HTTPException(404, "Doctor profile not found")
    
    doctor.specialization = data.specialization
    doctor.years_of_experience = data.years_of_experience
    doctor.hospital_id = data.hospital_id
    doctor.department_id = data.department_id
    
    if doctor.user:
        doctor.user.name = data.name
        doctor.user.phone = data.phone
        
    db.commit()
    return {"msg": "Doctor profile updated successfully"}

@app.delete("/doctors/{id}")
def delete_doctor(id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(403, "Admin only")
    doctor = db.query(models.Doctor).filter_by(id=id).first()
    if not doctor:
        raise HTTPException(404, "Doctor not found")
        
    db.delete(doctor.user)
    db.commit()
    return {"msg": "Doctor and linked user account removed cleanly"}

# =========================================================
# ---------------- BULK SLOT SYSTEM ---------------- #
# =========================================================
@app.post("/admin/generate-slots")
def generate_slots_automatic_bulk(
    data: List[schemas.BulkSlotCreate], 
    db: Session = Depends(get_db), 
    current_user=Depends(get_current_user)
):
    if current_user["role"] != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Access Denied: Administrative privileges required."
        )

    slots_created_count = 0
    for entry in data:
        try:
            start_time_obj = datetime.strptime(entry.start_time, "%H:%M")
            end_time_obj = datetime.strptime(entry.end_time, "%H:%M")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")

        time_pointer = start_time_obj
        while time_pointer < end_time_obj:
            next_time_pointer = time_pointer + timedelta(minutes=30)
            if next_time_pointer > end_time_obj:
                break
            new_slot = models.DoctorSlot(
                doctor_id=entry.doctor_id,
                date=entry.start_date, 
                start_time=time_pointer.strftime("%H:%M"),
                end_time=next_time_pointer.strftime("%H:%M"),
                is_booked=False
            )
            db.add(new_slot)
            slots_created_count += 1
            time_pointer = next_time_pointer

    db.commit()
    return {
        "status": "Success",
        "msg": f"Successfully sliced and committed {slots_created_count} intervals."
    }

@app.get("/slots/{doctor_id}")
def get_slots_by_date(doctor_id: int, date: date_type, db: Session = Depends(get_db)):
    return db.query(models.DoctorSlot).filter_by(doctor_id=doctor_id, date=date).all()

@app.delete("/slots/{id}")
def delete_slot(id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN":
        raise HTTPException(403, "Admin only")

    slot = db.query(models.DoctorSlot).filter_by(id=id).first()
    if not slot:
        raise HTTPException(404, "Slot not found")
    if slot.is_booked:
        raise HTTPException(400, "Cannot delete a booked slot.")

    db.delete(slot)
    db.commit()
    return {"msg": "Slot removed from inventory."}

# =========================================================
# ---------------- APPOINTMENT APIs ---------------- #
# =========================================================
@app.post("/appointments/book")
def book_appointment(payload: DirectBookRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "PATIENT":
        raise HTTPException(403, "Only patients can book")
    
    patient = db.query(models.Patient).filter_by(user_id=current_user["user_id"]).first()
    if not patient:
        raise HTTPException(404, "Patient profile wrapper context missing.")

    slot = db.query(models.DoctorSlot).filter_by(id=payload.slot_id).first()
    if not slot or slot.is_booked:
        raise HTTPException(400, "Slot unavailable")

    doctor = db.query(models.Doctor).filter_by(id=slot.doctor_id).first()

    slot.is_booked = True
    new_app = models.Appointment(
        patient_id=patient.id,
        doctor_id=slot.doctor_id,
        slot_id=slot.id,
        hospital_id=doctor.hospital_id,
        appointment_date=slot.date,
        status="SCHEDULED" 
    )
    
    db.add(new_app)
    db.commit()
    return {"msg": "Booking confirmed", "appointment_id": new_app.id}

@app.put("/appointments/reschedule/{appointment_id}")
def reschedule_appointment(
    appointment_id: int,
    payload: RescheduleRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment record not found.")

    if appointment.status in ["COMPLETED", "CANCELLED"]:
        raise HTTPException(status_code=400, detail="Cannot reschedule a completed or cancelled appointment.")

    if current_user["role"] == "PATIENT":
        patient = db.query(models.Patient).filter_by(user_id=current_user["user_id"]).first()
        if not patient or appointment.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Unauthorized transaction mapping modification.")

    new_slot = db.query(models.DoctorSlot).filter(models.DoctorSlot.id == payload.new_slot_id).first()
    if not new_slot:
        raise HTTPException(status_code=404, detail="Target slot does not exist in inventory baseline.")
    
    if new_slot.is_booked:
        raise HTTPException(status_code=400, detail="The selected alternative slot timing is already booked.")

    old_slot = db.query(models.DoctorSlot).filter(models.DoctorSlot.id == appointment.slot_id).first()
    if old_slot:
        old_slot.is_booked = False

    new_slot.is_booked = True
    appointment.slot_id = payload.new_slot_id
    appointment.appointment_date = new_slot.date 
    appointment.status = "SCHEDULED"

    db.commit()
    return {"status": "Success", "msg": "Reschedule action complete."}

@app.put("/appointments/cancel/{id}")
def cancel_appointment(id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    appt = db.query(models.Appointment).filter_by(id=id).first()
    if not appt:
        raise HTTPException(404, "Appointment not found")

    if appt.status == "COMPLETED":
        raise HTTPException(400, "You cannot cancel an appointment that has already been completed.")
    if appt.status == "CANCELLED":
        raise HTTPException(400, "This appointment is already cancelled.")

    slot = db.query(models.DoctorSlot).filter_by(id=appt.slot_id).first()
    if slot:
        slot.is_booked = False
    
    appt.status = "CANCELLED"
    db.commit()
    
    return {"msg": "Appointment cancelled and slot reopened."}

@app.put("/doctor/complete-appointment/{appointment_id}")
def complete_appointment(appointment_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "DOCTOR":
        raise HTTPException(403, "Only doctors can complete appointments")

    appointment = db.query(models.Appointment).filter_by(id=appointment_id).first()
    if not appointment:
        raise HTTPException(404, "Appointment not found")

    if appointment.status == "CANCELLED":
        raise HTTPException(400, "Cannot complete an appointment that has been cancelled.")

    appointment.status = "COMPLETED"
    db.commit()
    
    return {"message": "Appointment successfully marked as completed."}

# =========================================================
# ---------------- DOCTOR CLINICAL CONTROLS ---------------- #
# =========================================================
@app.put("/doctor/appointment/{appointment_id}/status")
def update_appointment_status(appointment_id: int, payload: StatusUpdateRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "DOCTOR":
        raise HTTPException(403, "Only doctors can update live status")

    appointment = db.query(models.Appointment).filter_by(id=appointment_id).first()
    if not appointment:
        raise HTTPException(404, "Appointment not found")

    if appointment.status == "COMPLETED" and payload.status != "COMPLETED":
        raise HTTPException(400, "Cannot change status of a completed appointment")

    appointment.status = payload.status
    db.commit()
    return {"msg": f"Status updated to {payload.status}"}

@app.put("/doctor/appointment/{appointment_id}/summary")
def save_appointment_summary(appointment_id: int, payload: SummaryRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "DOCTOR":
        raise HTTPException(403, "Only doctors can write summaries")

    appointment = db.query(models.Appointment).filter_by(id=appointment_id).first()
    if not appointment:
        raise HTTPException(404, "Appointment not found")

    appointment.appointment_summary = payload.summary
    appointment.status = "COMPLETED" 
    db.commit()
    return {"msg": "Clinical summary saved and appointment completed."}

# =========================================================
# ---------------- SYSTEM VIEWS ---------------- #
# =========================================================
@app.get("/system-overview")
def get_system_overview(db: Session = Depends(get_db)):
    return {
        "hospitals": db.query(models.Hospital).all(),
        "departments": db.query(models.Department).all(),
        "doctors": [
            {
                "id": d.id, 
                "name": d.user.name, 
                "specialization": d.specialization,
                "years_of_experience": d.years_of_experience, 
                "hospital_id": d.hospital_id,                
                "department_id": d.department_id             
            } for d in db.query(models.Doctor).all()
        ]
    }

# =========================================================
# ---------------- DASHBOARDS ---------------- #
# =========================================================
@app.get("/doctor/my-schedule")
def get_doctor_schedule(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "DOCTOR":
        raise HTTPException(403, "Access restricted to Doctors only")

    doctor = db.query(models.Doctor).filter_by(user_id=current_user["user_id"]).first()
    if not doctor:
        raise HTTPException(404, "Doctor profile not found")
    
    schedule = db.query(models.Appointment).filter_by(doctor_id=doctor.id).all()

    return [
        {
            "id": a.id,
            "patient_id": a.patient_id, 
            "patient_name": a.patient.user.name if a.patient and a.patient.user else "Unknown Patient",
            "date": a.appointment_date,
            "time": f"{a.slot.start_time} - {a.slot.end_time}" if a.slot else "N/A",
            "status": a.status,
            "summary": a.appointment_summary
        } for a in schedule
    ]

@app.get("/patient/appointments")
def get_patient_bookings_synchronized(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "PATIENT":
        raise HTTPException(403, "Access restricted to Patients only")

    patient = db.query(models.Patient).filter_by(user_id=current_user["user_id"]).first()
    if not patient:
        raise HTTPException(404, "Patient profile not found")
        
    # --- 🧹 AUTO-CLEANUP LOGIC STARTS HERE ---
    today = date_type.today()
    expired_bookings = db.query(models.Appointment).filter(
        models.Appointment.patient_id == patient.id,
        models.Appointment.appointment_date < today,
        models.Appointment.status.in_(["SCHEDULED", "CONFIRMED"])
    ).all()

    if expired_bookings:
        for b in expired_bookings:
            b.status = "CANCELLED" # or "NO-SHOW" if you prefer
        db.commit() # Save the cancellations to Supabase
    # --- 🧹 AUTO-CLEANUP LOGIC ENDS HERE ---

    # Now fetch the freshly updated list of bookings
    bookings = db.query(models.Appointment).filter_by(patient_id=patient.id).all()

    results = []
    for b in bookings:
        doc_name = b.slot.doctor.user.name if b.slot and b.slot.doctor else "Unknown Doctor"
        doc_id = b.slot.doctor_id if b.slot else None
        
        results.append({
            "id": b.id,
            "doctor_id": doc_id,
            "doctor_name": doc_name,
            "date": str(b.appointment_date),
            "start_time": b.slot.start_time if b.slot else "N/A",
            "end_time": b.slot.end_time if b.slot else "N/A",
            "status": b.status,
            "summary": b.appointment_summary
        })

    return results

# =========================================================
# ---- HELPER: EXTRACT & EMBED PDF (AI DATA PIPELINE) ----
# =========================================================
def process_and_embed_pdf(file_bytes: bytes, patient_id: int):
    reader = PdfReader(io.BytesIO(file_bytes))
    full_text = ""
    for page in reader.pages:
        extracted = page.extract_text()
        if extracted:
            full_text += extracted + "\n"
    
    chunk_size = 1000
    chunks = [full_text[i:i+chunk_size] for i in range(0, len(full_text), chunk_size)]

    for chunk in chunks:
        if len(chunk.strip()) > 10:
            embedding = genai.embed_content(
                model=embed_model,
                content=chunk,
                task_type="retrieval_document"
            )['embedding']
            
            supabase.table("patient_documents").insert({
                "patient_id": patient_id,
                "content": chunk,
                "embedding": embedding
            }).execute()

# =========================================================
# ---------------- PDF UPLOAD ROUTE ---------------- #
# =========================================================

# ── FIX: Now strictly requires an appointment_id to link the document! ──
@app.post("/patient/upload-records")
async def upload_medical_records(
    appointment_id: str = Form(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db), 
    current_user=Depends(get_current_user)
):
    if current_user["role"] != "PATIENT":
        raise HTTPException(403, "Only patients can upload records")

    try:
        user = db.query(models.User).filter_by(id=current_user["user_id"]).first()
        patient = db.query(models.Patient).filter_by(user_id=current_user["user_id"]).first()
        
        if not user or not patient:
            raise HTTPException(404, "Profile not found")
        
        real_patient_id = patient.id 
        uploaded_file_urls = []

        for file in files:
            file_bytes = await file.read()
            unique_id = str(uuid.uuid4())
            clean_filename = re.sub(r'[^a-zA-Z0-9_.-]', '_', file.filename)
            
            # ── FIX: Embed the specific appointment ID right into the file name! ──
            cloud_file_path = f"patient_{user.email}/appt_{appointment_id}_{unique_id}_{clean_filename}"
            
            supabase.storage.from_(BUCKET_NAME).upload(
                path=cloud_file_path,
                file=file_bytes,
                file_options={
                    "content-type": "application/pdf",
                    "upsert": "true" 
                }
            )
            
            public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(cloud_file_path)
            uploaded_file_urls.append(public_url)
            process_and_embed_pdf(file_bytes, real_patient_id)

        return {
            "status": "success", 
            "message": f"Successfully uploaded {len(files)} records.",
            "urls": uploaded_file_urls
        }

    except Exception as e:
        print(f"Upload Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to upload files to cloud storage.")
    
@app.get("/patient/my-documents")
def get_patient_documents(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "PATIENT":
        raise HTTPException(403, "Only patients can view their records")
    
    user = db.query(models.User).filter_by(id=current_user["user_id"]).first()
    if not user:
        raise HTTPException(404, "User not found")
        
    folder_path = f"patient_{user.email}"
    
    try:
        files = supabase.storage.from_(BUCKET_NAME).list(folder_path)
        
        results = []
        for f in files:
            if f['name'] == '.emptyFolderPlaceholder':
                continue
                
            file_path = f"{folder_path}/{f['name']}"
            public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(file_path)
            
            # ── FIX: Clean the filename so it looks pretty for the user ──
            # Removes the "appt_12_uuid_" part and just leaves "blood_test.pdf"
            display_name = f['name']
            display_name = re.sub(r'^appt_\d+_[a-f0-9\-]+_', '', display_name)

            results.append({
                "id": f.get('id', file_path),
                "name": display_name,
                "url": public_url,
                "path": file_path
            })
            
        return results
    except Exception as e:
        print(f"Storage List Error: {str(e)}")
        return []
    
@app.delete("/patient/document")
def delete_patient_document(file_path: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "PATIENT":
        raise HTTPException(403, "Only patients can delete records")
    
    user = db.query(models.User).filter_by(id=current_user["user_id"]).first()
    if not user:
        raise HTTPException(404, "User not found")
        
    if not file_path.startswith(f"patient_{user.email}/"):
        raise HTTPException(403, "Unauthorized file access")

    try:
        supabase.storage.from_(BUCKET_NAME).remove([file_path])
        return {"msg": "File deleted successfully"}
    except Exception as e:
        print(f"Delete Error: {str(e)}")
        raise HTTPException(500, "Failed to delete file from cloud storage")

# =========================================================
# ---------------- AI RAG: CHATBOT LOGIC ---------------- #
# =========================================================

@app.post("/doctor/chat")
def doctor_ai_chat(payload: ChatRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.get("role") != "DOCTOR":
        raise HTTPException(403, "Only doctors can access the AI Assistant")

    try:
        patient = db.query(models.Patient).filter_by(id=payload.patient_id).first()
        if not patient:
            return {"answer": "I apologize, but I cannot locate this patient's database record."}

        db_context = f"Patient Name: {patient.user.name}\n"
        db_context += f"Age: {patient.age}, Gender: {patient.gender}, Blood Group: {patient.blood_group}\n\n"
        
        appointments = db.query(models.Appointment).filter_by(patient_id=payload.patient_id).all()
        db_context += "Appointment History:\n"
        if not appointments:
            db_context += "No previous appointments on record.\n"
        else:
            for appt in appointments:
                doc_name = appt.doctor.user.name if appt.doctor and appt.doctor.user else "Unknown"
                summary_note = appt.appointment_summary or "No notes recorded"
                
                time_window = f"{appt.slot.start_time} to {appt.slot.end_time}" if appt.slot else "Unknown Time"
                
                db_context += f"- Date: {appt.appointment_date} | Time: {time_window} | Status: {appt.status} | Seen by: Dr. {doc_name} | Doctor Notes: {summary_note}\n"

        question_embedding = genai.embed_content(
            model=embed_model,
            content=payload.question,
            task_type="retrieval_query"
        )['embedding']

        search_results = supabase.rpc("match_documents", {
            "query_embedding": question_embedding,
            "match_threshold": 0.2, 
            "match_count": 5,       
            "p_id": payload.patient_id
        }).execute()
        
        pdf_context = "No uploaded medical PDFs found."
        if search_results.data:
            pdf_context = "\n\n".join([item["content"] for item in search_results.data])

        doc_name_clean = payload.doctor_name

        prompt = f"""
        You are an intelligent, exceptionally polite, and friendly medical AI assistant.
        
        CRITICAL RULES:
        1. Always maintain a warm, respectful, and highly polite tone.
        2. GREETING RULE: IF AND ONLY IF the doctor says a simple greeting (like "hi", "hello", "hey"), you MUST reply EXACTLY with: "Hello {doc_name_clean}! How may I assist you today?"
        3. DIRECT ANSWER RULE: If the doctor asks a specific question, DO NOT use any greetings. Skip the "Hello" entirely and just answer the question directly.
        4. Answer the doctor's questions using ONLY the Database Context and Document Context provided. 
        5. If a medical question cannot be answered using the provided contexts, politely apologize.
        6. IGNORE NAME MISMATCHES: Because this is a testing environment, assume ALL provided documents belong to the patient {patient.user.name}.

        --- DATABASE PROFILE & APPOINTMENTS ---
        {db_context}
        
        --- UPLOADED MEDICAL DOCUMENTS ---
        {pdf_context}
        
        Doctor's Input: {payload.question}
        """

        response = chat_model.generate_content(prompt)
        return {"answer": response.text}
        
    except Exception as e:
        print(f"AI Chat Error: {str(e)}")
        raise HTTPException(status_code=500, detail="The AI Assistant encountered an error.")