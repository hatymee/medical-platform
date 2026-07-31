from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role, get_current_user
from app.models.models import (
    User, Doctor, Consultation, Prescription, RecordAccessGrant, AccessStatus,
)
from app.schemas.schemas import (
    ConsultationCreate, ConsultationOut, PrescriptionCreate, PrescriptionOut,
)

router = APIRouter(tags=["clinical"])


def _get_doctor(db: Session, user: User) -> Doctor:
    return db.query(Doctor).filter(Doctor.user_id == user.id).first()


def _doctor_has_active_access(db: Session, doctor_id: str, patient_id: str) -> bool:
    grant = (
        db.query(RecordAccessGrant)
        .filter(
            RecordAccessGrant.doctor_id == doctor_id,
            RecordAccessGrant.patient_id == patient_id,
            RecordAccessGrant.status == AccessStatus.approved,
        )
        .order_by(RecordAccessGrant.responded_at.desc())
        .first()
    )
    if not grant:
        return False
    if grant.expires_at and grant.expires_at < datetime.now(timezone.utc):
        return False
    return True


@router.post("/consultations", response_model=ConsultationOut, status_code=201)
def create_consultation(
    payload: ConsultationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("doctor")),
):
    doctor = _get_doctor(db, current_user)
    if not _doctor_has_active_access(db, doctor.id, payload.patient_id):
        raise HTTPException(status_code=403, detail="Aucun acces autorise a ce dossier")

    consultation = Consultation(
        patient_id=payload.patient_id,
        doctor_id=doctor.id,
        reason=payload.reason,
        notes=payload.notes,
    )
    db.add(consultation)
    db.commit()
    db.refresh(consultation)
    return consultation


@router.get("/consultations/patient/{patient_id}", response_model=list[ConsultationOut])
def list_patient_consultations(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "patient":
        if current_user.patient.id != patient_id:
            raise HTTPException(status_code=403, detail="Acces refuse")
    elif current_user.role == "doctor":
        doctor = _get_doctor(db, current_user)
        if not _doctor_has_active_access(db, doctor.id, patient_id):
            raise HTTPException(status_code=403, detail="Aucun acces autorise a ce dossier")
    else:
        raise HTTPException(status_code=403, detail="Acces refuse")

    return (
        db.query(Consultation)
        .filter(Consultation.patient_id == patient_id)
        .order_by(Consultation.consultation_date.desc())
        .all()
    )


@router.post(
    "/consultations/{consultation_id}/prescriptions",
    response_model=PrescriptionOut,
    status_code=201,
)
def create_prescription(
    consultation_id: str,
    payload: PrescriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("doctor")),
):
    consultation = db.get(Consultation, consultation_id)
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation introuvable")

    doctor = _get_doctor(db, current_user)
    if consultation.doctor_id != doctor.id:
        raise HTTPException(status_code=403, detail="Cette consultation ne t'appartient pas")

    prescription = Prescription(consultation_id=consultation_id, **payload.model_dump())
    db.add(prescription)
    db.commit()
    db.refresh(prescription)
    return prescription


@router.get(
    "/consultations/{consultation_id}/prescriptions",
    response_model=list[PrescriptionOut],
)
def list_prescriptions(
    consultation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    consultation = db.get(Consultation, consultation_id)
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation introuvable")

    if current_user.role == "patient":
        if consultation.patient_id != current_user.patient.id:
            raise HTTPException(status_code=403, detail="Acces refuse")
    elif current_user.role == "doctor":
        doctor = _get_doctor(db, current_user)
        if consultation.doctor_id != doctor.id:
            raise HTTPException(status_code=403, detail="Acces refuse")
    else:
        raise HTTPException(status_code=403, detail="Acces refuse")

    return (
        db.query(Prescription)
        .filter(Prescription.consultation_id == consultation_id)
        .all()
    )
