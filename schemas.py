import re
from pydantic import BaseModel, field_validator, EmailStr
from datetime import date
from typing import Optional, List

# ==========================================
# 1. MASTER USER SCHEMA (Identity)
# ==========================================
class UserCreate(BaseModel):
    name: str
    email: EmailStr 
    password: str
    phone: str
    role: str # "ADMIN", "PATIENT", or "DOCTOR"

    @field_validator('phone')
    def validate_phone(cls, value):
        if not re.match(r'^\d{10}$', value):
            raise ValueError("Phone number must be exactly 10 digits")
        return value

class LoginSchema(BaseModel):
    email: str
    password: str

# ==========================================
# 2. PATIENT SCHEMA (Medical)
# ==========================================
class PatientCreate(UserCreate):
    gender: Optional[str] = None
    age: Optional[int] = None
    blood_group: Optional[str] = None

# ==========================================
# 3. INFRASTRUCTURE SCHEMAS
# ==========================================
class HospitalCreate(BaseModel):
    name: str
    location: str

class DepartmentCreate(BaseModel):
    name: str
    hospital_id: int

# ==========================================
# 4. DOCTOR SCHEMAS
# ==========================================
class DoctorCreate(UserCreate):
    specialization: str
    years_of_experience: int
    hospital_id: int
    department_id: int

# ==========================================
# 5. SLOT & BULK GENERATION
# ==========================================

# Use this to get the "JSON Body" look in Swagger
class BulkSlotCreate(BaseModel):
    doctor_id: int
    start_date: date
    end_date: date
    start_time: str = "09:00"
    end_time: str = "17:00"

# This is what the Patient sees when checking a date
class SlotResponse(BaseModel):
    id: int
    doctor_id: int
    date: date
    start_time: str
    end_time: str
    is_booked: bool # ✅ This is your availability tracker

    class Config:
        from_attributes = True

# ==========================================
# 6. BOOKING SCHEMAS
# ==========================================
class AppointmentCreate(BaseModel):
    slot_id: int

class RescheduleRequest(BaseModel):
    new_slot_id: int