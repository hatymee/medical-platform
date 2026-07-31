from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.models import User, Appointment, AppointmentStatus
from app.schemas.schemas import AppointmentCreate, AppointmentOut

router = APIRouter(prefix="/appointments", tags=["appointments"])


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
    # TODO V2 : déclencher l'envoi de la confirmation email + rappels J-1 / H-2
    return appointment


@router.get("/mine", response_model=list[AppointmentOut])
def my_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("patient", "doctor")),
):
    query = db.query(Appointment)
    if current_user.role == "patient":
        query = query.filter(Appointment.patient_id == current_user.patient.id)
    else:
        from app.models.models import Doctor
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        query = query.filter(Appointment.doctor_id == doctor.id)
    return query.order_by(Appointment.scheduled_at.asc()).all()


@router.patch("/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("patient", "doctor")),
):
    appointment = db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Rendez-vous introuvable")
    appointment.status = AppointmentStatus.cancelled
    db.commit()
    db.refresh(appointment)
    return appointment
