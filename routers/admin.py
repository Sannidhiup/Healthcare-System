from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime, timedelta

import models, schemas
from database import get_db
from dependencies import get_current_user
from routers.auth import hash_password # Re-using the hash function

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

# --- HOSPITALS ---
@router.post("/hospitals/bulk")
def create_multiple_hospitals(data: List[schemas.HospitalCreate], db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": raise HTTPException(403, "Admin only")
    for h_data in data: db.add(models.Hospital(**h_data.dict()))
    db.commit()
    return {"msg": f"Successfully created {len(data)} hospitals!"}

@router.put("/hospitals/{id}")
def update_hospital(id: int, data: schemas.HospitalCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": raise HTTPException(403, "Admin only")
    hospital = db.query(models.Hospital).filter_by(id=id).first()
    if not hospital: raise HTTPException(404, "Hospital not found")
    hospital.name, hospital.location = data.name, data.location
    db.commit()
    return {"msg": "Hospital updated successfully"}

@router.delete("/hospitals/{id}")
def delete_hospital(id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": raise HTTPException(403, "Admin only")
    hospital = db.query(models.Hospital).filter_by(id=id).first()
    if not hospital: raise HTTPException(404, "Hospital not found")
    db.delete(hospital) 
    db.commit()
    return {"msg": "Hospital and all related data removed."}

# --- DEPARTMENTS ---
@router.post("/departments")
def create_department(data: schemas.DepartmentCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": raise HTTPException(403, "Admin only")
    new_dept = models.Department(name=data.name, hospital_id=data.hospital_id)
    db.add(new_dept)
    db.commit()
    return {"msg": "Department created successfully"}

@router.put("/departments/{id}")
def update_department(id: int, data: schemas.DepartmentCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": raise HTTPException(403, "Admin only")
    dept = db.query(models.Department).filter_by(id=id).first()
    if not dept: raise HTTPException(404, "Department not found")
    dept.name, dept.hospital_id = data.name, data.hospital_id
    db.commit()
    return {"msg": "Department updated successfully"}

@router.delete("/departments/{id}")
def delete_department(id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": raise HTTPException(403, "Admin only")
    dept = db.query(models.Department).filter_by(id=id).first()
    if not dept: raise HTTPException(404, "Department not found")
    db.delete(dept)
    db.commit()
    return {"msg": "Department deleted successfully"}

# --- PATIENT MANAGEMENT ---
class PatientEditRequest(schemas.BaseModel):
    name: str; phone: str; age: int; blood_group: str

@router.get("/patients")
def get_all_patients(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": raise HTTPException(403, "Admin only")
    patients = db.query(models.Patient).options(joinedload(models.Patient.user)).all()
    return [{"id": p.id, "user_id": p.user_id, "name": p.user.name, "email": p.user.email, "phone": p.user.phone, "age": p.age, "blood_group": p.blood_group} for p in patients]

@router.put("/patients/{user_id}")
def edit_patient_details(user_id: int, data: PatientEditRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": raise HTTPException(403, "Admin only")
    user = db.query(models.User).filter_by(id=user_id, role="PATIENT").first()
    patient = db.query(models.Patient).filter_by(user_id=user_id).first()
    if not user or not patient: raise HTTPException(404, "Patient not found")
    user.name, user.phone = data.name, data.phone
    patient.age, patient.blood_group = data.age, data.blood_group
    db.commit()
    return {"msg": "Patient updated successfully"}

# --- DOCTOR MANAGEMENT & SLOTS ---
@router.post("/doctors")
def create_doctor(data: schemas.DoctorCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": raise HTTPException(403, "Admin only")
    new_user = models.User(name=data.name, email=data.email, password=hash_password(data.password), phone=data.phone, role="DOCTOR")
    db.add(new_user)
    db.flush()
    new_doctor = models.Doctor(user_id=new_user.id, specialization=data.specialization, years_of_experience=data.years_of_experience, hospital_id=data.hospital_id, department_id=data.department_id)
    db.add(new_doctor)
    db.commit()
    return {"msg": f"Doctor {new_user.name} registered."}

@router.put("/doctors/{id}")
def update_doctor(id: int, data: schemas.DoctorCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": raise HTTPException(403, "Admin only")
    doctor = db.query(models.Doctor).filter_by(id=id).first()
    if not doctor: raise HTTPException(404, "Doctor profile not found")
    doctor.specialization, doctor.years_of_experience, doctor.hospital_id, doctor.department_id = data.specialization, data.years_of_experience, data.hospital_id, data.department_id
    if doctor.user: doctor.user.name, doctor.user.phone = data.name, data.phone
    db.commit()
    return {"msg": "Doctor profile updated successfully"}

@router.delete("/doctors/{id}")
def delete_doctor(id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": raise HTTPException(403, "Admin only")
    doctor = db.query(models.Doctor).filter_by(id=id).first()
    if not doctor: raise HTTPException(404, "Doctor not found")
    db.delete(doctor.user)
    db.commit()
    return {"msg": "Doctor and linked user account removed cleanly"}

@router.post("/generate-slots")
def generate_slots_automatic_bulk(data: List[schemas.BulkSlotCreate], db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin required.")
    count = 0
    for entry in data:
        try:
            time_pointer = datetime.strptime(entry.start_time, "%H:%M")
            end_time_obj = datetime.strptime(entry.end_time, "%H:%M")
        except ValueError: raise HTTPException(400, "Invalid time format.")
        while time_pointer < end_time_obj:
            next_time_pointer = time_pointer + timedelta(minutes=30)
            if next_time_pointer > end_time_obj: break
            db.add(models.DoctorSlot(doctor_id=entry.doctor_id, date=entry.start_date, start_time=time_pointer.strftime("%H:%M"), end_time=next_time_pointer.strftime("%H:%M"), is_booked=False))
            count += 1
            time_pointer = next_time_pointer
    db.commit()
    return {"msg": f"Successfully committed {count} intervals."}