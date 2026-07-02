import os
from dotenv import load_dotenv

# ── 1. LOAD PASSWORDS FIRST ──
load_dotenv()

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from datetime import date as date_type

from database import Base, engine, get_db
import models

# ── 2. IMPORT ROUTERS ──
from routers import auth, admin, doctor, patient

# Create Tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Hospital Management System API")

# ── 3. CONFIGURE CORS ──
# Note: In production, it is safer to use your specific Vercel URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 4. WIRE UP THE ROUTERS ──
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(doctor.router)
app.include_router(patient.router)

# ── 5. ROOT AND SHARED PUBLIC ROUTES ──
@app.get("/")
def home():
    return {"message": "Hospital Management System API v4 (Modular) is Online"}

@app.get("/system-overview")
def get_system_overview(db: Session = Depends(get_db)):
    doctors = db.query(models.Doctor).options(
        joinedload(models.Doctor.user),
        joinedload(models.Doctor.departments)   # eager-load the many-to-many relationship
    ).all()
    
    return {
        "hospitals": db.query(models.Hospital).all(),
        "departments": db.query(models.Department).all(),
        "doctors": [
            {
                "id": d.id, 
                "name": d.user.name, 
                "email": d.user.email, 
                "phone": d.user.phone, 
                "specialization": d.specialization, 
                "years_of_experience": d.years_of_experience, 
                "hospital_id": d.hospital_id, 
                "department_ids": [dept.id for dept in d.departments]   # list now, not a single id
            } for d in doctors
        ]
    }

@app.get("/slots/{doctor_id}")
def get_slots_by_date(doctor_id: int, date: date_type, db: Session = Depends(get_db)):
    return db.query(models.DoctorSlot).filter_by(doctor_id=doctor_id, date=date).all()