from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date, Boolean
from sqlalchemy.orm import relationship
from database import Base
import datetime

# ==========================================
# 1. USER IDENTITY (Login Credentials)
# ==========================================
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    phone = Column(String, unique=True)
    role = Column(String)  # "ADMIN", "PATIENT", or "DOCTOR"
    
    # ── NEW: PERMANENT STORAGE FOR PASSWORD RESET OTPS ──
    reset_otp = Column(String, nullable=True)
    reset_otp_expire = Column(DateTime, nullable=True)
    
    # cascade="all, delete-orphan" ensures if a user is deleted, their profile is too
    patient_profile = relationship("Patient", back_populates="user", uselist=False, cascade="all, delete-orphan")
    doctor_profile = relationship("Doctor", back_populates="user", uselist=False, cascade="all, delete-orphan")

# ==========================================
# 2. PATIENT PROFILE
# ==========================================
class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    age = Column(Integer)
    gender = Column(String)
    blood_group = Column(String, nullable=True) 
    
    user = relationship("User", back_populates="patient_profile")
    appointments = relationship("Appointment", back_populates="patient", cascade="all, delete-orphan")

# ==========================================
# 3. HOSPITAL & DEPARTMENT
# ==========================================
class Hospital(Base):
    __tablename__ = "hospitals"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    location = Column(String)
    
class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"))

# ==========================================
# 4. DOCTOR PROFILE
# ==========================================
class Doctor(Base):
    __tablename__ = "doctors"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    specialization = Column(String)
    years_of_experience = Column(Integer)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"))
    department_id = Column(Integer, ForeignKey("departments.id"))
    
    user = relationship("User", back_populates="doctor_profile")
    slots = relationship("DoctorSlot", back_populates="doctor", cascade="all, delete-orphan")
    
    # ✅ Link doctor directly to their hospital
    hospital = relationship("Hospital")

# ==========================================
# 5. DOCTOR SLOTS (The Manual Inventory)
# ==========================================
class DoctorSlot(Base):
    __tablename__ = "doctor_slots"
    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"))
    date = Column(Date) 
    start_time = Column(String) # e.g. "09:00"
    end_time = Column(String)   # e.g. "09:30"
    is_booked = Column(Boolean, default=False)
    
    doctor = relationship("Doctor", back_populates="slots")
    # CRITICAL: Added cascade here so deleting a slot cleans up the relationship logic
    appointment = relationship("Appointment", back_populates="slot", uselist=False, cascade="all, delete-orphan")

# ==========================================
# 6. APPOINTMENT (The Link & Clinical Notes)
# ==========================================
class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id")) 
    doctor_id = Column(Integer, ForeignKey("doctors.id"))
    slot_id = Column(Integer, ForeignKey("doctor_slots.id")) 
    hospital_id = Column(Integer, ForeignKey("hospitals.id"))
    
    # Stores the actual date of the visit
    appointment_date = Column(Date) 
    
    # This default lambda handles the +5:30 offset for IST
    booked_at = Column(DateTime, default=lambda: datetime.datetime.utcnow() + datetime.timedelta(hours=5, minutes=30))
    
    status = Column(String, default="SCHEDULED") 

    # ── PERMANENT STORAGE FOR DOCTOR'S CLINICAL SUMMARY ──
    appointment_summary = Column(String, nullable=True)

    patient = relationship("Patient", back_populates="appointments")
    slot = relationship("DoctorSlot", back_populates="appointment")
    doctor = relationship("Doctor")