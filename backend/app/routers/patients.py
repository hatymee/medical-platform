from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.deps import require_role
from app.core.database import get_db
from sqlalchemy.orm import Session
from app.models.models import User, Patient
from app.schemas.schemas import PatientProfile, PatientProfileUpdate, SecretaryPatientUpdate
from app.models.models import Patient as PatientModel


router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("/me", response_model=PatientProfile)
def get_my_profile(current_user: User = Depends(require_role("patient"))):
    return current_user.patient


@router.patch("/me", response_model=PatientProfile)
def update_my_profile(
    payload: PatientProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("patient")),
):
    patient = current_user.patient
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(patient, field, value)
    db.commit()
    db.refresh(patient)
    return patient


@router.get("/search", response_model=list[PatientProfile])
def search_patients(
    term: str = Query(min_length=2),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("secretary", "doctor", "clinic_admin")),
):
    return db.query(Patient).filter((Patient.national_id.ilike(f"%{term}%")) | (Patient.last_name.ilike(f"%{term}%"))).limit(20).all()


@router.patch("/{patient_id}/administrative", response_model=PatientProfile)
def update_patient_administrative(
    patient_id: str,
    payload: SecretaryPatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("secretary", "clinic_admin")),
):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)
    db.commit(); db.refresh(patient)
    return patient

@router.get("/", response_model=list[PatientProfile])
def list_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("secretary", "clinic_admin")),    
):
    return db.query(Patient).order_by(Patient.last_name).all()