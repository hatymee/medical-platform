import random
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import require_role
from app.models.models import (
    User, Patient, Doctor, RecordAccessGrant, AccessStatus, AccessLog,
)
from app.schemas.schemas import AccessGrantRequest, AccessGrantRespond, AccessGrantOut

router = APIRouter(prefix="/access", tags=["record-access"])


@router.post("/request", response_model=AccessGrantOut)
def request_access(
    payload: AccessGrantRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("doctor")),
):
    """
    Le médecin demande l'accès au dossier d'un patient.
    Le patient reçoit une demande "pending" qu'il doit valider dans son app
    (via code temporaire — QR/NFC viendront en V2 sur le même mécanisme).
    """
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    patient_user = db.query(User).filter(User.email == payload.patient_email).first()
    if not patient_user or not patient_user.patient:
        raise HTTPException(status_code=404, detail="Patient introuvable")

    code = "".join(random.choices(string.digits, k=6))
    grant = RecordAccessGrant(
        patient_id=patient_user.patient.id,
        doctor_id=doctor.id,
        status=AccessStatus.pending,
        access_code=code,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.RECORD_ACCESS_DEFAULT_HOURS),
    )
    db.add(grant)
    db.commit()
    db.refresh(grant)
    # TODO V2 : notifier le patient (push/SMS) avec le code
    return grant


@router.post("/respond", response_model=AccessGrantOut)
def respond_access(
    payload: AccessGrantRespond,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("patient")),
):
    """Le patient approuve ou refuse une demande d'accès à son dossier."""
    grant = db.get(RecordAccessGrant, payload.grant_id)
    if not grant or grant.patient_id != current_user.patient.id:
        raise HTTPException(status_code=404, detail="Demande introuvable")

    grant.status = AccessStatus.approved if payload.approve else AccessStatus.denied
    grant.responded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(grant)
    return grant


@router.get("/my-requests", response_model=list[AccessGrantOut])
def my_pending_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("patient")),
):
    """Liste des demandes d'accès en attente pour le patient connecté."""
    return (
        db.query(RecordAccessGrant)
        .filter(RecordAccessGrant.patient_id == current_user.patient.id)
        .order_by(RecordAccessGrant.requested_at.desc())
        .all()
    )

@router.get("/my-patients")
def my_authorized_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("doctor")),
):
    """Patients ayant accordé au médecin connecté un accès encore valide."""
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Profil médecin introuvable")

    now = datetime.now(timezone.utc)
    grants = (
        db.query(RecordAccessGrant)
        .filter(
            RecordAccessGrant.doctor_id == doctor.id,
            RecordAccessGrant.status == AccessStatus.approved,
        )
        .order_by(RecordAccessGrant.responded_at.desc())
        .all()
    )

    seen, result = set(), []
    for grant in grants:
        if grant.patient_id in seen:
            continue
        if grant.expires_at and grant.expires_at < now:
            continue
        patient = db.get(Patient, grant.patient_id)
        if not patient:
            continue
        seen.add(patient.id)
        result.append({
            "id": patient.id,
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "date_of_birth": str(patient.date_of_birth) if patient.date_of_birth else None,
            "national_id": patient.national_id,
            "sex": patient.sex,
            "blood_group": getattr(patient, "blood_group", None),
            "granted_at": grant.responded_at,
            "expires_at": grant.expires_at,
        })
    return result