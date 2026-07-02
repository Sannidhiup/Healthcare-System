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
from jose import jwt, JWTError

router = APIRouter(tags=["Authentication"])

pwd_context = CryptContext(schemes=["bcrypt"])

# In-memory store for pending registration OTPs: { phone: {"otp": str, "expire": datetime} }
# Cleared once verified. Note: resets if the server restarts / won't work across multiple workers -
# fine for now, move to a DB table or Redis if you scale to multiple processes.
pending_registration_otps = {}


def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str):
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=60)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def send_sms(to_phone: str, body: str):
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_SID")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_TOKEN")
    TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE", "+18604078159")

    target_phone = to_phone if to_phone.startswith("+") else f"+91{to_phone}"
    client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    client.messages.create(body=body, from_=TWILIO_PHONE_NUMBER, to=target_phone)


# ==========================================
# PATIENT REGISTRATION — STEP 1: SEND OTP
# ==========================================
@router.post("/register/send-otp")
def send_registration_otp(payload: schemas.OtpSendRequest, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.phone == payload.phone).first():
        raise HTTPException(400, "Phone number already registered")

    otp_code = str(random.randint(100000, 999999))
    expiration = datetime.now(timezone.utc) + timedelta(minutes=10)
    pending_registration_otps[payload.phone] = {"otp": otp_code, "expire": expiration}

    try:
        send_sms(
            payload.phone,
            f"Your Hospital Portal registration OTP is: {otp_code}. Do not share this with anyone."
        )
    except Exception as e:
        print(f"Twilio Failed: {e}")
        del pending_registration_otps[payload.phone]
        raise HTTPException(500, "Failed to send OTP. Please try again.")

    return {"message": "OTP sent to your phone number."}


# ==========================================
# PATIENT REGISTRATION — STEP 2: VERIFY OTP
# ==========================================
@router.post("/register/verify-otp")
def verify_registration_otp(payload: schemas.OtpVerifyRequest):
    record = pending_registration_otps.get(payload.phone)
    if not record:
        raise HTTPException(400, "No OTP request found for this phone number. Please request a new OTP.")

    if datetime.now(timezone.utc) > record["expire"]:
        del pending_registration_otps[payload.phone]
        raise HTTPException(400, "OTP has expired. Please request a new one.")

    if record["otp"] != payload.otp:
        raise HTTPException(400, "Invalid OTP code.")

    # OTP consumed - clear it so it can't be reused
    del pending_registration_otps[payload.phone]

    # Short-lived token proving this phone was verified. Required by /register.
    reg_token = jwt.encode(
        {
            "phone": payload.phone,
            "purpose": "patient_registration",
            "exp": datetime.utcnow() + timedelta(minutes=10)
        },
        SECRET_KEY, algorithm=ALGORITHM
    )
    return {"registration_token": reg_token}


# ==========================================
# PATIENT REGISTRATION — STEP 3: CREATE ACCOUNT
# (requires a valid registration_token from step 2)
# ==========================================
@router.post("/register")
def register(user: schemas.PatientRegisterWithOtp, db: Session = Depends(get_db)):
    try:
        token_data = jwt.decode(user.registration_token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Invalid or expired registration token. Please verify your phone again.")

    if token_data.get("purpose") != "patient_registration":
        raise HTTPException(401, "Invalid registration token.")

    if token_data.get("phone") != user.phone:
        raise HTTPException(400, "Phone number does not match the number that was OTP-verified.")

    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(400, "Email already exists")

    if db.query(models.User).filter(models.User.phone == user.phone).first():
        raise HTTPException(400, "Phone number already registered")

    new_user = models.User(
        name=user.name, email=user.email,
        password=hash_password(user.password),
        phone=user.phone, role="PATIENT"
    )
    db.add(new_user)
    db.flush()

    new_profile = models.Patient(
        user_id=new_user.id, age=user.age,
        gender=user.gender, blood_group=user.blood_group
    )
    db.add(new_profile)

    db.commit()
    return {"msg": "Patient account created successfully!"}


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
            department = doctor.departments[0] if doctor.departments else None
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
    
    try:
        send_sms(
            str(user.phone),
            f"Your Hospital Portal secure password reset code is: {otp_code}. Do not share this with anyone."
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