from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.models import User, Doctor, Procedure

router = APIRouter(prefix="/procedures", tags=["procedures"])


class ProcedureCreate(BaseModel):
    label: str
    price: float


class ProcedureUpdate(BaseModel):
    label: str | None = None
    price: float | None = None
    is_active: bool | None = None


def _out(p: Procedure) -> dict:
    return {
        "id": p.id,
        "doctor_id": p.doctor_id,
        "label": p.label,
        "price": float(p.price),
        "is_active": p.is_active,
    }


@router.get("")
def list_procedures(
    doctor_id: str | None = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("doctor", "secretary", "clinic_admin")),
):
    """Actes d'un medecin. Sans doctor_id, un medecin voit les siens."""
    query = db.query(Procedure)

    if doctor_id:
        query = query.filter(Procedure.doctor_id == doctor_id)
    elif current_user.role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if not doctor:
            raise HTTPException(status_code=403, detail="Profil medecin introuvable")
        query = query.filter(Procedure.doctor_id == doctor.id)

    if not include_inactive:
        query = query.filter(Procedure.is_active.is_(True))

    return [_out(p) for p in query.order_by(Procedure.label).all()]


@router.post("", status_code=201)
def create_procedure(
    payload: ProcedureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("doctor")),
):
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=403, detail="Profil medecin introuvable")
    if payload.price < 0:
        raise HTTPException(status_code=400, detail="Le tarif ne peut pas etre negatif")

    procedure = Procedure(
        doctor_id=doctor.id,
        label=payload.label.strip(),
        price=Decimal(str(payload.price)),
    )
    db.add(procedure)
    db.commit()
    db.refresh(procedure)
    return _out(procedure)


@router.patch("/{procedure_id}")
def update_procedure(
    procedure_id: str,
    payload: ProcedureUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("doctor")),
):
    procedure = db.get(Procedure, procedure_id)
    if not procedure:
        raise HTTPException(status_code=404, detail="Acte introuvable")

    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor or procedure.doctor_id != doctor.id:
        raise HTTPException(status_code=403, detail="Cet acte ne vous appartient pas")

    if payload.label is not None:
        procedure.label = payload.label.strip()
    if payload.price is not None:
        if payload.price < 0:
            raise HTTPException(status_code=400, detail="Le tarif ne peut pas etre negatif")
        procedure.price = Decimal(str(payload.price))
    if payload.is_active is not None:
        procedure.is_active = payload.is_active

    db.commit()
    db.refresh(procedure)
    return _out(procedure)