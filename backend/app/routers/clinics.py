from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.models import User, Clinic, Doctor, Secretary
from app.schemas.schemas import ClinicCreate, ClinicOut, DoctorProfile, DoctorProfileUpdate
from app.core.security import hash_password

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


@router.get("/doctors", response_model=list[DoctorProfile])
def list_all_doctors(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("secretary", "clinic_admin", "patient")),
):
    return db.query(Doctor).order_by(Doctor.last_name).all()


@router.get("/clinics/me", response_model=ClinicOut)
def my_clinic(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("clinic_admin", "doctor", "secretary")),
):
    """La clinique de l'utilisateur connecte, quel que soit son role."""
    clinic_id = None
    if current_user.role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        clinic_id = doctor.clinic_id if doctor else None
    elif current_user.role == "secretary":
        secretary = db.query(Secretary).filter(Secretary.user_id == current_user.id).first()
        clinic_id = secretary.clinic_id if secretary else None
    else:
        clinic = db.query(Clinic).filter(Clinic.admin_user_id == current_user.id).first()
        clinic_id = clinic.id if clinic else None

    if not clinic_id:
        raise HTTPException(status_code=404, detail="Aucune clinique rattachee a ce compte")

    clinic = db.get(Clinic, clinic_id)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinique introuvable")
    return clinic


@router.get("/secretaries")
def list_secretaries(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("clinic_admin", "doctor")),
):
    rows = db.query(Secretary, User).join(User, Secretary.user_id == User.id).all()
    return [
        {
            "id": s.id,
            "user_id": u.id,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "email": u.email,
            "is_active": u.is_active,
        }
        for s, u in rows
    ]


class StaffUpdate(BaseModel):
    email: str | None = None
    is_active: bool | None = None
    reset_password: str | None = None


@router.patch("/staff/{user_id}")
def update_staff(
    user_id: str,
    payload: StaffUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("clinic_admin", "super_admin")),
):
    """Gestion d'un compte professionnel par l'administrateur du cabinet."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    if user.role not in ("doctor", "secretary"):
        raise HTTPException(status_code=403, detail="Seuls les comptes professionnels sont gerables ici")
    if user.id == current_user.id:
        raise HTTPException(status_code=403, detail="Vous ne pouvez pas modifier votre propre compte ici")

    if payload.email:
        existing = db.query(User).filter(User.email == payload.email, User.id != user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Cet email est deja utilise")
        user.email = payload.email.strip()

    if payload.reset_password:
        if len(payload.reset_password) < 8:
            raise HTTPException(status_code=400, detail="Huit caracteres minimum")
        user.hashed_password = hash_password(payload.reset_password)

    if payload.is_active is not None:
        user.is_active = payload.is_active

    db.commit()
    return {"id": user.id, "email": user.email, "is_active": user.is_active}

@router.get("/staff/doctors")
def list_doctors_for_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("clinic_admin", "super_admin")),
):
    """Liste enrichie pour la gestion des comptes par l'administrateur."""
    rows = db.query(Doctor, User).join(User, Doctor.user_id == User.id).order_by(Doctor.last_name).all()
    return [
        {
            "id": d.id,
            "user_id": u.id,
            "first_name": d.first_name,
            "last_name": d.last_name,
            "specialty": d.specialty,
            "email": u.email,
            "is_active": u.is_active,
        }
        for d, u in rows
    ]