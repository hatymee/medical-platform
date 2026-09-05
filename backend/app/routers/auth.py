import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role, get_current_user
from app.core.security import hash_password, verify_password, create_access_token
from app.models.models import User, Patient, Doctor, Secretary, UserRole
from app.schemas.schemas import (
    PatientRegister,
    DoctorRegister,
    SecretaryRegister,
    LoginRequest,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class EmailChange(BaseModel):
    current_password: str
    new_email: EmailStr


@router.post("/register/patient", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_patient(payload: PatientRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Cet email est deja utilise")

    user = User(email=payload.email, password_hash=hash_password(payload.password), role=UserRole.patient)
    db.add(user)
    db.flush()

    patient = Patient(
        user_id=user.id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        date_of_birth=payload.date_of_birth,
        sex=payload.sex,
        blood_group=payload.blood_group,
    )
    db.add(patient)
    db.commit()

    token = create_access_token(subject=user.id, role=user.role.value)
    return TokenResponse(access_token=token, role=user.role.value)


@router.post("/register/doctor", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_doctor(
    payload: DoctorRegister,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("clinic_admin", "super_admin")),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Cet email est deja utilise")

    user = User(email=payload.email, password_hash=hash_password(payload.password), role=UserRole.doctor)
    db.add(user)
    db.flush()

    doctor = Doctor(
        user_id=user.id,
        first_name=payload.first_name,
        last_name=payload.last_name,
    )
    db.add(doctor)
    db.commit()

    token = create_access_token(subject=user.id, role=user.role.value)
    return TokenResponse(access_token=token, role=user.role.value)


@router.post("/register/secretary", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_secretary(
    payload: SecretaryRegister,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("clinic_admin", "super_admin")),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Cet email est deja utilise")

    user = User(email=payload.email, password_hash=hash_password(payload.password), role=UserRole.secretary)
    db.add(user)
    db.flush()
    db.add(Secretary(
        user_id=user.id,
        clinic_id=payload.clinic_id,
        first_name=payload.first_name,
        last_name=payload.last_name,
    ))
    db.commit()

    token = create_access_token(subject=user.id, role=user.role.value)
    return TokenResponse(access_token=token, role=user.role.value)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    token = create_access_token(subject=user.id, role=user.role.value)
    return TokenResponse(access_token=token, role=user.role.value)


@router.post("/change-password")
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit faire au moins 8 caracteres")

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"detail": "Mot de passe mis a jour"}


@router.post("/change-email")
def change_email(
    payload: EmailChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mot de passe incorrect")

    existing = db.query(User).filter(User.email == payload.new_email).first()
    if existing and existing.id != current_user.id:
        raise HTTPException(status_code=400, detail="Cet email est deja utilise")

    current_user.email = payload.new_email
    db.commit()
    return {"detail": "Email mis a jour", "email": current_user.email}


@router.post("/patients/{patient_id}/reset-password")
def reset_patient_password(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("secretary", "clinic_admin")),
):
    """Genere un mot de passe temporaire pour un patient qui n'arrive plus a se connecter."""
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient introuvable")

    user = db.get(User, patient.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Compte introuvable")

    alphabet = string.ascii_letters + string.digits
    temp = "".join(secrets.choice(alphabet) for _ in range(10))
    user.password_hash = hash_password(temp)
    db.commit()

    return {
        "email": user.email,
        "temporary_password": temp,
        "detail": "Communiquez ce mot de passe au patient de vive voix.",
    }