import models

def create_patient(db: Session, patient: schemas.PatientCreate, hashed_password: str):
    db_patient = models.Patient(
        name=patient.name,
        email=patient.email,
        password=hashed_password,
        phone=patient.phone,
        gender=patient.gender,
        age=patient.age,
        role="PATIENT"
    )
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient

def get_patient_by_email(db, email):
    return db.query(models.Patient).filter(models.Patient.email == email).first()