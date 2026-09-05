import re
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

ALLOWED_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/heic",
}
MAX_UPLOAD_BYTES = 15 * 1024 * 1024


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


def _require_doctor(db: Session, user: User) -> Doctor:
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=403, detail="Profil medecin introuvable")
    return doctor


def _safe_filename(name: str) -> str:
    """Retire tout composant de chemin et ne garde qu'un nom de fichier inoffensif."""
    base = name.replace("\\", "/").split("/")[-1]
    base = re.sub(r"[^A-Za-z0-9._-]", "_", base).lstrip(".")
    return base[:120] or "document"


@router.get("/patient/{patient_id}", response_model=list[MedicalDocumentOut])
def list_patient_documents(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "patient":
        if not current_user.patient or current_user.patient.id != patient_id:
            raise HTTPException(status_code=403, detail="Acces refuse")
    elif current_user.role == "doctor":
        doctor = _require_doctor(db, current_user)
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
async def upload_document(
    category: DocumentCategory = Form(...),
    title: str = Form(...),
    document_date: str = Form(...),
    file: UploadFile = File(...),
    patient_id: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("patient", "doctor", "secretary")),
):
    if current_user.role == "patient":
        if not current_user.patient:
            raise HTTPException(status_code=403, detail="Profil patient introuvable")
        patient_id = current_user.patient.id

    if not patient_id:
        raise HTTPException(status_code=400, detail="Le patient doit etre indique")

    if current_user.role == "doctor":
        doctor = _require_doctor(db, current_user)
        if not _doctor_has_active_access(db, doctor.id, patient_id):
            raise HTTPException(status_code=403, detail="Aucun acces autorise a ce dossier")
        db.add(AccessLog(doctor_id=doctor.id, patient_id=patient_id, action="uploaded_document"))

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(            status_code=415,
            detail="Format non accepte. Formats autorises : PDF, JPEG, PNG, HEIC.",
        )

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (15 Mo maximum).")
    if not contents:
        raise HTTPException(status_code=400, detail="Le fichier est vide.")

    stored_name = _safe_filename(file.filename or "document")
    file_url = f"local://uploads/{patient_id}/{stored_name}"

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