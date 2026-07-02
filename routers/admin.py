from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime, timedelta
import re

import models, schemas
from database import get_db
from dependencies import get_current_user
from routers.auth import hash_password 

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

# --- HOSPITALS ---
@router.get("/hospitals")
def get_all_hospitals(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": raise HTTPException(403, "Admin only")
    return db.query(models.Hospital).all()

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
@router.get("/departments")
def get_all_departments(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": raise HTTPException(403, "Admin only")
    return db.query(models.Department).all()

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
@router.get("/doctors")
def get_all_doctors(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": raise HTTPException(403, "Admin only")
    doctors = db.query(models.Doctor).options(
        joinedload(models.Doctor.user),
        joinedload(models.Doctor.hospital),
        joinedload(models.Doctor.departments)
    ).all()
    
    return [{
        "id": d.id,
        "name": d.user.name,
        "email": d.user.email, 
        "phone": d.user.phone, 
        "specialization": d.specialization,
        "years_of_experience": d.years_of_experience,
        "hospital_id": d.hospital_id,
        "hospital_name": d.hospital.name if d.hospital else None,
        "departments": [{"id": dept.id, "name": dept.name} for dept in d.departments]
    } for d in doctors]

@router.post("/doctors")
def create_doctor(data: schemas.DoctorCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": raise HTTPException(403, "Admin only")
    
    # FIX: Moved IGNORECASE to the flags parameter to fix the 500 Regex error
    clean_name = re.sub(r'^(dr\.\s*|dr\s+)+', 'Dr. ', data.name.strip(), flags=re.IGNORECASE)
    
    try:
        # 1. Create the base User account first
        new_user = models.User(name=clean_name, email=data.email, password=hash_password(data.password), phone=data.phone, role="DOCTOR")
        db.add(new_user)
        db.flush() # CRITICAL: This assigns an ID to new_user so the Doctor model can link to it
        
        # 2. Create the Doctor profile linked to the User
        new_doctor = models.Doctor(
            user_id=new_user.id, 
            specialization=data.specialization, 
            years_of_experience=data.years_of_experience, 
            hospital_id=data.hospital_id
        )
        
        # 3. Link Departments if provided
        if data.department_ids:
            departments = db.query(models.Department).filter(models.Department.id.in_(data.department_ids)).all()
            new_doctor.departments = departments

        db.add(new_doctor)
        db.commit()
        return {"msg": f"Doctor {new_user.name} registered with {len(new_doctor.departments)} departments."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create doctor. Ensure email is unique. System error: {str(e)}")

@router.put("/doctors/{id}")
def update_doctor(id: int, data: schemas.DoctorCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": raise HTTPException(403, "Admin only")
    
    doctor = db.query(models.Doctor).filter_by(id=id).first()
    if not doctor: raise HTTPException(404, "Doctor profile not found")
    
    doctor.specialization = data.specialization
    doctor.years_of_experience = data.years_of_experience
    doctor.hospital_id = data.hospital_id
   
    # FIX: Moved IGNORECASE to the flags parameter
    clean_name = re.sub(r'^(dr\.\s*|dr\s+)+', 'Dr. ', data.name.strip(), flags=re.IGNORECASE)
    
    if doctor.user: 
        doctor.user.name = clean_name
        doctor.user.phone = data.phone
        # If admin tries to update the password and it is not the default dummy payload
        if data.password and data.password != "dummy123":
            doctor.user.password = hash_password(data.password)
        
    if data.department_ids is not None:
        departments = db.query(models.Department).filter(models.Department.id.in_(data.department_ids)).all()
        doctor.departments = departments

    db.commit()
    return {"msg": f"{clean_name}'s profile updated."}

@router.delete("/doctors/{id}")
def delete_doctor(id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": raise HTTPException(403, "Admin only")
    
    doctor = db.query(models.Doctor).filter_by(id=id).first()
    if not doctor: raise HTTPException(404, "Doctor not found")
    
    # 1. Delete all slots associated with this doctor FIRST to prevent Foreign Key blocks
    db.query(models.DoctorSlot).filter_by(doctor_id=id).delete()
    
    # 2. Save the user reference
    user_record = doctor.user
    
    # 3. Delete the Doctor profile
    db.delete(doctor)
    
    # 4. Finally, delete the parent User record
    if user_record:
        db.delete(user_record)
        
    db.commit()
    return {"msg": "Doctor, related slots, and user account removed cleanly."}

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

@router.delete("/slots/{id}")
def delete_doctor_slot(id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user["role"] != "ADMIN": 
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
        
    slot = db.query(models.DoctorSlot).filter_by(id=id).first()
    
    if not slot: 
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Slot not found")
        
    db.delete(slot)
    db.commit()
    
    return {"msg": "Slot entry deleted cleanly."}