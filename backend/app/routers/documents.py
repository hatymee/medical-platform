from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role, get_current_user
from app.models.models import (
    User, Doctor, MedicalDocument, RecordAccessGrant, AccessStatus, AccessLog, DocumentCategory,
)
from app.schemas.schemas import MedicalDocumentOut

router = APIRouter(prefix="/documents", tags=["documents"])


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


@router.get("/patient/{patient_id}", response_model=list[MedicalDocumentOut])
def list_patient_documents(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "patient":
        if current_user.patient.id != patient_id:
            raise HTTPException(status_code=403, detail="Acces refuse")
    elif current_user.role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if not _doctor_has_active_access(db, doctor.id, patient_id):
            raise HTTPException(status_code=403, detail="Aucun acces autorise a ce dossier")
        db.add(AccessLog(doctor_id=doctor.id, patient_id=patient_id, action="viewed_documents"))
        db.commit()
    else:
        raise HTTPException(status_code=403, detail="Acces refuse")

    return (
        db.query(MedicalDocument)
        .filter(MedicalDocument.patient_id == patient_id)
        .order_by(MedicalDocument.document_date.desc())
        .all()
    )


@router.post("/upload", response_model=MedicalDocumentOut)
def upload_document(
    category: DocumentCategory = Form(...),
    title: str = Form(...),
    document_date: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("patient", "doctor")),
):
    patient_id = current_user.patient.id if current_user.role == "patient" else None
    if patient_id is None:
        raise HTTPException(status_code=400, detail="Seul le patient peut associer un document a son dossier pour l'instant")

    file_url = f"local://uploads/{patient_id}/{file.filename}"

    doc = MedicalDocument(
        patient_id=patient_id,
        uploaded_by=current_user.id,
        category=category,
        title=title,
        file_url=file_url,
        document_date=document_date,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc
