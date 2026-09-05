from datetime import datetime, date, time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.models import User, Doctor, Appointment, AppointmentStatus
from app.schemas.schemas import (
    AppointmentCreate,
    AppointmentOut,
    SecretariatAppointmentCreate,
    AppointmentUpdate,
)

router = APIRouter(prefix="/appointments", tags=["appointments"])

WORKING_HOURS = [
    "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00",
    "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00",
]


# 1. Créneaux disponibles pour une date et un médecin
@router.get("/available-slots/")
def get_available_slots(
    target_date: date = Query(...),
    doctor_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Appointment).filter(
        Appointment.scheduled_at >= datetime.combine(target_date, time.min),
        Appointment.scheduled_at <= datetime.combine(target_date, time.max),
        Appointment.status != AppointmentStatus.cancelled,
    )
    if doctor_id:
        query = query.filter(Appointment.doctor_id == doctor_id)

    booked = {a.scheduled_at.strftime("%H:%M") for a in query.all()}

    return {
        "date": target_date,
        "working_hours": WORKING_HOURS,
        "available_slots": [s for s in WORKING_HOURS if s not in booked],
    }


# 2. Création par le patient
@router.post("/", response_model=AppointmentOut)
def create_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("patient")),
):
    doctor = db.get(Doctor, payload.doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Médecin introuvable.")

    conflict = db.query(Appointment).filter(
        Appointment.doctor_id == doctor.id,
        Appointment.scheduled_at == payload.scheduled_at,
        Appointment.status != AppointmentStatus.cancelled,
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="Ce créneau vient d'être réservé.")

    appointment = Appointment(
        patient_id=current_user.patient.id,
        doctor_id=doctor.id,
        scheduled_at=payload.scheduled_at,
        reason=payload.reason,
        status=AppointmentStatus.scheduled,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


# 3. Création par le secrétariat
@router.post("/secretariat", response_model=AppointmentOut)
def create_appointment_for_patient(
    payload: SecretariatAppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("secretary", "clinic_admin")),
):
    doctor = db.get(Doctor, payload.doctor_id) if payload.doctor_id else db.query(Doctor).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Médecin introuvable.")

    conflict = db.query(Appointment).filter(
        Appointment.doctor_id == doctor.id,
        Appointment.scheduled_at == payload.scheduled_at,
        Appointment.status != AppointmentStatus.cancelled,
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="Ce créneau est déjà occupé.")

    appointment = Appointment(
        patient_id=payload.patient_id,
        doctor_id=doctor.id,
        scheduled_at=payload.scheduled_at,
        reason=payload.reason,
        status=AppointmentStatus.scheduled,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


# 4. Rendez-vous de l'utilisateur connecté
@router.get("/mine", response_model=list[AppointmentOut])
def my_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("patient", "doctor")),
):
    query = db.query(Appointment)
    if current_user.role == "patient":
        query = query.filter(Appointment.patient_id == current_user.patient.id)
    else:
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if not doctor:
            raise HTTPException(status_code=404, detail="Profil médecin introuvable.")
        query = query.filter(Appointment.doctor_id == doctor.id)
    return query.order_by(Appointment.scheduled_at.asc()).all()


# 5. Annulation
@router.patch("/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("patient", "doctor", "secretary", "clinic_admin")),
):
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Rendez-vous introuvable")

    if current_user.role == "patient":
        if not current_user.patient or appointment.patient_id != current_user.patient.id:
            raise HTTPException(status_code=403, detail="Ce rendez-vous ne vous appartient pas.")
    elif current_user.role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if not doctor or appointment.doctor_id != doctor.id:
            raise HTTPException(status_code=403, detail="Ce rendez-vous ne vous appartient pas.")

    appointment.status = AppointmentStatus.cancelled
    db.commit()
    db.refresh(appointment)
    return appointment


# 6. Reprogrammation
@router.put("/{appointment_id}", response_model=AppointmentOut)
def update_appointment(
    appointment_id: str,
    payload: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("secretary", "clinic_admin")),
):
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Rendez-vous introuvable")

    if payload.scheduled_at is not None:
        appointment.scheduled_at = payload.scheduled_at
    if getattr(payload, "doctor_id", None) is not None:
        appointment.doctor_id = payload.doctor_id
    if payload.status is not None:
        appointment.status = payload.status
    if payload.reason is not None:
        appointment.reason = payload.reason

    db.commit()
    db.refresh(appointment)
    return appointment


# 7. Suppression définitive
@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("secretary", "clinic_admin")),
):
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Rendez-vous introuvable")

    db.delete(appointment)
    db.commit()
    return None


# 8. Tous les rendez-vous (secrétariat)
@router.get("/", response_model=list[AppointmentOut])
def list_all_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("secretary", "clinic_admin")),
):
    return db.query(Appointment).order_by(Appointment.scheduled_at.asc()).all()