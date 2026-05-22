from fastapi import FastAPI, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from database import Base, engine, SessionLocal
import models, schemas
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta, date as date_type
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List
from pydantic import BaseModel

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware

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

@app.get("/")
def home():
    return {"message": "Hospital Management System API v3 (Manual Inventory) is Online"}

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
    
    # ✅ Now returning the exact name to the frontend!
    return {
        "access_token": token, 
        "token_type": "bearer",
        "name": user.name, 
        "role": user.role
    }

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

# --- DEPARTMENT APIs ---

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
        status="CONFIRMED"
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

    if current_user["role"] == "PATIENT":
        patient = db.query(models.Patient).filter_by(user_id=current_user["user_id"]).first()
        if not patient or appointment.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Unauthorized transaction mapping modification.")

    new_slot = db.query(models.DoctorSlot).filter(models.DoctorSlot.id == payload.new_slot_id).first()
    if not new_slot:
        raise HTTPException(status_code=404, detail="Target slot does not exist in inventory baseline.")
    
    if new_slot.is_booked:
        raise HTTPException(status_code=400, detail="The selected alternative slot timing is already booked.")

    # Reopen the previous time slot reference back to free inventory
    old_slot = db.query(models.DoctorSlot).filter(models.DoctorSlot.id == appointment.slot_id).first()
    if old_slot:
        old_slot.is_booked = False

    # Lock and switch variables over to the newly selected slot
    new_slot.is_booked = True
    appointment.slot_id = payload.new_slot_id
    appointment.appointment_date = new_slot.date 

    db.commit()
    return {"status": "Success", "msg": "Reschedule action complete."}

@app.delete("/appointments/cancel/{id}")
def cancel_appointment(id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    appt = db.query(models.Appointment).filter_by(id=id).first()
    if not appt:
        raise HTTPException(404, "Appointment not found")

    slot = db.query(models.DoctorSlot).filter_by(id=appt.slot_id).first()
    if slot:
        slot.is_booked = False
    
    db.delete(appt)
    db.commit()
    return {"msg": "Appointment cancelled and slot reopened."}

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
            "patient_name": a.patient.user.name if a.patient and a.patient.user else "Unknown Patient",
            "date": a.appointment_date,
            "time": f"{a.slot.start_time} - {a.slot.end_time}" if a.slot else "N/A",
            "status": a.status
        } for a in schedule
    ]

@app.get("/patient/appointments")
def get_patient_bookings_synchronized(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "PATIENT":
        raise HTTPException(403, "Access restricted to Patients only")

    patient = db.query(models.Patient).filter_by(user_id=current_user["user_id"]).first()
    if not patient:
        raise HTTPException(404, "Patient profile not found")
    
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
            "status": "CONFIRMED"
        })

    return results