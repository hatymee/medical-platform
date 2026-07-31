from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.models import User, Clinic, Doctor
from app.schemas.schemas import ClinicCreate, ClinicOut, DoctorProfile, DoctorProfileUpdate

router = APIRouter(tags=["clinics"])


# --------------------------- CLINICS ---------------------------

@router.post("/clinics", response_model=ClinicOut, status_code=201)
def create_clinic(
    payload: ClinicCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("doctor", "clinic_admin", "super_admin")),
):
    """
    MVP : tout médecin peut créer une clinique et s'y rattacher.
    TODO V2 : restreindre la création aux clinic_admin, avec un flux d'invitation
    pour rattacher des médecins existants à une clinique.
    """
    clinic = Clinic(name=payload.name, address=payload.address, phone=payload.phone)
    db.add(clinic)
    db.commit()
    db.refresh(clinic)
    return clinic


@router.get("/clinics/{clinic_id}", response_model=ClinicOut)
def get_clinic(clinic_id: str, db: Session = Depends(get_db)):
    clinic = db.get(Clinic, clinic_id)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinique introuvable")
    return clinic


@router.get("/clinics/{clinic_id}/doctors", response_model=list[DoctorProfile])
def list_clinic_doctors(clinic_id: str, db: Session = Depends(get_db)):
    return db.query(Doctor).filter(Doctor.clinic_id == clinic_id).all()


# --------------------------- DOCTOR PROFILE ---------------------------

@router.get("/doctors/me", response_model=DoctorProfile)
def get_my_doctor_profile(current_user: User = Depends(require_role("doctor"))):
    return current_user.doctor


@router.patch("/doctors/me", response_model=DoctorProfile)
def update_my_doctor_profile(
    payload: DoctorProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("doctor")),
):
    doctor = current_user.doctor
    updates = payload.model_dump(exclude_unset=True)

    if "clinic_id" in updates and updates["clinic_id"] is not None:
        if not db.get(Clinic, updates["clinic_id"]):
            raise HTTPException(status_code=404, detail="Clinique introuvable")

    for field, value in updates.items():
        setattr(doctor, field, value)
    db.commit()
    db.refresh(doctor)
    return doctor
