from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.models import User, Patient
from app.schemas.schemas import PatientProfile, PatientProfileUpdate, SecretaryPatientUpdate

router = APIRouter(prefix="/patients", tags=["patients"])

ACTIVE = "active"
ARCHIVED = "archived"
REMOVED = "removed"
VALID_STATUSES = {ACTIVE, ARCHIVED, REMOVED}


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
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)
    db.commit()
    db.refresh(patient)
    return patient


@router.get("/search", response_model=list[PatientProfile])
def search_patients(
    term: str = Query(min_length=2),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("secretary", "doctor", "clinic_admin")),
):
    query = db.query(Patient).filter(
        (Patient.national_id.ilike(f"%{term}%"))
        | (Patient.last_name.ilike(f"%{term}%"))
        | (Patient.first_name.ilike(f"%{term}%"))
    )
    if not include_inactive:
        query = query.filter(Patient.status == ACTIVE)
    return query.order_by(Patient.last_name).limit(20).all()


@router.get("/", response_model=list[PatientProfile])
def list_patients(
    status: str = Query(ACTIVE),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("secretary", "doctor", "clinic_admin")),
):
    """Liste des patients. status accepte active, archived, removed ou all."""
    query = db.query(Patient)
    if status != "all":
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail="Statut inconnu")
        query = query.filter(Patient.status == status)
    return query.order_by(Patient.last_name).all()


@router.patch("/{patient_id}/administrative", response_model=PatientProfile)
def update_patient_administrative(
    patient_id: str,
    payload: SecretaryPatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("secretary", "doctor", "clinic_admin")),
):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)
    db.commit()
    db.refresh(patient)
    return patient


@router.patch("/{patient_id}/status", response_model=PatientProfile)
def change_patient_status(
    patient_id: str,
    status: str = Query(...),
    reason: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("secretary", "doctor", "clinic_admin")),
):
    """
    Archive, retire ou reactive un patient.

    Rien n'est efface : le dossier, les consultations et les factures
    restent en base et redeviennent visibles en repassant le statut a active.
    """
    if status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Statut inconnu")

    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient introuvable")

    if status == REMOVED and not reason:
        raise HTTPException(status_code=400, detail="Un motif est requis pour retirer un patient")

    patient.status = status
    patient.status_reason = reason if status != ACTIVE else None
    patient.status_changed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(patient)
    return patient