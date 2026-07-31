from fastapi import APIRouter, Depends

from app.core.deps import require_role
from app.core.database import get_db
from sqlalchemy.orm import Session
from app.models.models import User
from app.schemas.schemas import PatientProfile, PatientProfileUpdate

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
