from datetime import datetime, date, time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.models import User, Doctor, Appointment, AppointmentStatus
from app.schemas.schemas import (
    AppointmentCreate, 
    AppointmentOut, 
    SecretariatAppointmentCreate, 
    AppointmentUpdate
)

router = APIRouter(prefix="/appointments", tags=["appointments"])


# 1. Vérifier la disponibilité des créneaux pour une date et un médecin
@router.get("/available-slots/")
def get_available_slots(
    doctor_id: str,
    target_date: date = Query(...),
    db: Session = Depends(get_db),
):
    working_hours = [
        "09:00", "09:30", "10:00", "10:30", 
        "11:00", "11:30", "15:00", "15:30", "16:00"
    ]
    
    existing_appointments = db.query(Appointment).filter(
        Appointment.doctor_id == doctor_id,
        Appointment.scheduled_at >= datetime.combine(target_date, time.min),
        Appointment.scheduled_at <= datetime.combine(target_date, time.max),
        Appointment.status != AppointmentStatus.cancelled
    ).all()

    booked_slots = [apt.scheduled_at.strftime("%H:%M") for apt in existing_appointments]
    available_slots = [slot for slot in working_hours if slot not in booked_slots]
    
    return {"date": target_date, "available_slots": available_slots}


# 2. Création par le patient
@router.post("/", response_model=AppointmentOut)
def create_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("patient")),
):
    appointment = Appointment(
        patient_id=current_user.patient.id,
        doctor_id=payload.doctor_id,
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
    appointment = Appointment(
        patient_id=payload.patient_id, 
        doctor_id=payload.doctor_id, 
        scheduled_at=payload.scheduled_at, 
        reason=payload.reason, 
        status=AppointmentStatus.scheduled
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


# 4. Liste des rendez-vous de l'utilisateur connecté
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
        query = query.filter(Appointment.doctor_id == doctor.id)
    return query.order_by(Appointment.scheduled_at.asc()).all()


# 5. Annulation d'un rendez-vous
@router.patch("/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("patient", "doctor", "secretary", "clinic_admin")),
):
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Rendez-vous introuvable")
    appointment.status = AppointmentStatus.cancelled
    db.commit()
    db.refresh(appointment)
    return appointment


# 6. Modification / Reprogrammation complète du RDV (Date, Heure, Médecin, Motif)
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

    # Mise à jour des champs modifiés
    if payload.scheduled_at is not None:
        appointment.scheduled_at = payload.scheduled_at
    if hasattr(payload, 'doctor_id') and payload.doctor_id is not None:
        appointment.doctor_id = payload.doctor_id
    if payload.status is not None:
        appointment.status = payload.status
    if payload.reason is not None:
        appointment.reason = payload.reason

    db.commit()
    db.refresh(appointment)
    return appointment


# 7. Suppression définitive (Réservé au Secrétariat)
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