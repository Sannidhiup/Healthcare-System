from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timedelta, timezone
from twilio.rest import Client
import os
import random

import models, schemas
from database import get_db
from dependencies import get_current_user, SECRET_KEY, ALGORITHM
from passlib.context import CryptContext
from jose import jwt

router = APIRouter(tags=["Authentication"])

pwd_context = CryptContext(schemes=["bcrypt"])

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str):
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=60)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

@router.post("/register")
def register(user: schemas.PatientCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(400, "Email already exists")
    
    new_user = models.User(
        name=user.name, email=user.email,
        password=hash_password(user.password),
        phone=user.phone, role=user.role.upper()
    )
    db.add(new_user)
    db.flush() 

    if new_user.role == "PATIENT":
        new_profile = models.Patient(
            user_id=new_user.id, age=user.age,
            gender=user.gender, blood_group=user.blood_group
        )
        db.add(new_profile)
    
    db.commit()
    return {"msg": f"{new_user.role} account created successfully!"}

@router.post("/login")
def login(data: schemas.LoginSchema, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not verify_password(data.password, user.password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    token = create_access_token({"user_id": user.id, "role": user.role})
    response_data = {
        "access_token": token, "token_type": "bearer",
        "name": user.name, "role": user.role, "extra_info": "" 
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

@router.post("/forgot-password")
def request_password_reset(req: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user or user.role != "PATIENT":
        return {"message": "If a patient account exists for this email, an OTP has been sent."}
    
    otp_code = str(random.randint(100000, 999999))
    expiration = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    user.reset_otp = otp_code
    user.reset_otp_expire = expiration
    db.commit()
    
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_SID")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_TOKEN")
    TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE", "+18604078159") 
    
    try:
        patient_phone = str(user.phone)
        if not patient_phone.startswith("+"):
            patient_phone = f"+91{patient_phone}" 
            
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        message = client.messages.create(
            body=f"Your Hospital Portal secure password reset code is: {otp_code}. Do not share this with anyone.",
            from_=TWILIO_PHONE_NUMBER, to=patient_phone
        )
    except Exception as e:
        print(f"Twilio Failed: {e}")
    
    return {"message": "If a patient account exists for this email, an OTP has been sent."}

@router.post("/reset-password")
def reset_password(req: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user or user.role != "PATIENT":
        raise HTTPException(status_code=400, detail="Invalid request.")
    if user.reset_otp != req.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP code.")
    if not user.reset_otp_expire or datetime.now(timezone.utc) > user.reset_otp_expire:
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")
        
    user.password = hash_password(req.new_password)
    user.reset_otp = None
    user.reset_otp_expire = None
    db.commit()
    return {"message": "Password successfully reset!"}