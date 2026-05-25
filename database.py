import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Your PostgreSQL connection string
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:Admin123@localhost:5432/hospital_db")

engine = create_engine(SQLALCHEMY_DATABASE_URL)

# ==========================================
# 1. UPGRADE: Session Safeguards
# ==========================================
# autocommit=False and autoflush=False force the database to wait 
# for your explicit `db.commit()` in main.py, preventing partial data saves if an error occurs.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# ==========================================
# 2. UPGRADE: The FastAPI Dependency 
# ==========================================
# This acts as a safe "pipeline" for your routes. It opens a connection 
# when a patient makes a request, and guarantees it closes when the request is done.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()