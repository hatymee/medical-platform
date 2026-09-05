import uuid
import enum
from datetime import datetime, date

from sqlalchemy import String, Boolean, DateTime, Date, ForeignKey, Enum, Text, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


# --------------------------- ENUMS ---------------------------

class UserRole(str, enum.Enum):
    patient = "patient"
    doctor = "doctor"
    clinic_admin = "clinic_admin"
    secretary = "secretary"
    super_admin = "super_admin"


class AccessStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    denied = "denied"
    expired = "expired"
    revoked = "revoked"


class DocumentCategory(str, enum.Enum):
    prescription = "prescription"
    lab_result = "lab_result"
    xray = "xray"
    mri = "mri"
    ct_scan = "ct_scan"
    ultrasound = "ultrasound"
    operative_report = "operative_report"
    consultation_note = "consultation_note"
    other = "other"


class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"
    confirmed = "confirmed"
    cancelled = "cancelled"
    completed = "completed"
    no_show = "no_show"


class InvoiceStatus(str, enum.Enum):
    unpaid = "unpaid"
    partial = "partial"
    paid = "paid"
    cancelled = "cancelled"


# --------------------------- CORE MODELS ---------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    patient: Mapped["Patient"] = relationship(back_populates="user", uselist=False)
    doctor: Mapped["Doctor"] = relationship(back_populates="user", uselist=False)
    secretary_profile: Mapped["Secretary"] = relationship(back_populates="user", uselist=False)


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), unique=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    date_of_birth: Mapped[date] = mapped_column(Date)
    sex: Mapped[str | None] = mapped_column(String(20))
    blood_group: Mapped[str] = mapped_column(String(10), default="unknown")
    national_id: Mapped[str | None] = mapped_column(String(50))
    address: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="active")
    status_reason: Mapped[str | None] = mapped_column(Text)
    status_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="patient")


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), unique=True)
    clinic_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("clinics.id"))
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    specialty: Mapped[str | None] = mapped_column(String(150))
    license_number: Mapped[str | None] = mapped_column(String(100))

    user: Mapped["User"] = relationship(back_populates="doctor")


class Clinic(Base):
    __tablename__ = "clinics"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(30))


class Secretary(Base):
    __tablename__ = "secretaries"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), unique=True)
    clinic_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("clinics.id"))
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    user: Mapped["User"] = relationship(back_populates="secretary_profile")


class RecordAccessGrant(Base):
    __tablename__ = "record_access_grants"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("patients.id"))
    doctor_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("doctors.id"))
    status: Mapped[AccessStatus] = mapped_column(Enum(AccessStatus), default=AccessStatus.pending)
    access_code: Mapped[str | None] = mapped_column(String(20))
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MedicalDocument(Base):
    __tablename__ = "medical_documents"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("patients.id"))
    uploaded_by: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"))
    category: Mapped[DocumentCategory] = mapped_column(Enum(DocumentCategory))
    title: Mapped[str] = mapped_column(String(255))
    file_url: Mapped[str] = mapped_column(Text)
    document_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Consultation(Base):
    __tablename__ = "consultations"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("patients.id"))
    doctor_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("doctors.id"))
    consultation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    reason: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    consultation_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("consultations.id"))
    medication_name: Mapped[str] = mapped_column(String(255))
    dosage: Mapped[str | None] = mapped_column(String(100))
    duration: Mapped[str | None] = mapped_column(String(100))
    instructions: Mapped[str | None] = mapped_column(Text)


class AccessLog(Base):
    __tablename__ = "access_logs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    grant_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("record_access_grants.id"))
    doctor_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("doctors.id"))
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("patients.id"))
    action: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=gen_uuid
    )

    patient_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("patients.id"),
        nullable=False
    )

    doctor_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("doctors.id"),
        nullable=False
    )

    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )

    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus),
        default=AppointmentStatus.scheduled,
        nullable=False
    )

    reason: Mapped[str | None] = mapped_column(Text)


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    doctor_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("doctors.id"))
    clinic_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("clinics.id"))
    consultation_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("consultations.id"))
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    amount_due: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), default=InvoiceStatus.unpaid)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    invoice_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("invoices.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    method: Mapped[str] = mapped_column(String(30), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(100))
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
