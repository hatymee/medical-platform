from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.models import User, Patient, Doctor, UserRole
from app.schemas.schemas import PatientRegister, DoctorRegister, LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register/patient", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_patient(payload: PatientRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")

    user = User(email=payload.email, password_hash=hash_password(payload.password), role=UserRole.patient)
    db.add(user)
    db.flush()  # récupère user.id sans commit

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
def register_doctor(payload: DoctorRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")

    user = User(email=payload.email, password_hash=hash_password(payload.password), role=UserRole.doctor)
    db.add(user)
    db.flush()

    doctor = Doctor(
        user_id=user.id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        specialty=payload.specialty,
        license_number=payload.license_number,
    )
    db.add(doctor)
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
