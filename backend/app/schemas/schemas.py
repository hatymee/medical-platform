from datetime import date, datetime
from pydantic import BaseModel, EmailStr


# --------------------------- AUTH ---------------------------

class PatientRegister(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    date_of_birth: date
    sex: str | None = None
    blood_group: str = "unknown"


class DoctorRegister(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    specialty: str | None = None
    license_number: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


# --------------------------- PATIENT ---------------------------

class PatientProfile(BaseModel):
    id: str
    first_name: str
    last_name: str
    date_of_birth: date
    sex: str | None
    blood_group: str
    address: str | None

    class Config:
        from_attributes = True


class PatientProfileUpdate(BaseModel):
    """Tous les champs sont optionnels : seuls ceux fournis sont modifiés."""
    first_name: str | None = None
    last_name: str | None = None
    sex: str | None = None
    blood_group: str | None = None
    address: str | None = None


# --------------------------- CLINICS / DOCTORS ---------------------------

class ClinicCreate(BaseModel):
    name: str
    address: str | None = None
    phone: str | None = None


class ClinicOut(BaseModel):
    id: str
    name: str
    address: str | None
    phone: str | None

    class Config:
        from_attributes = True


class DoctorProfile(BaseModel):
    id: str
    first_name: str
    last_name: str
    specialty: str | None
    license_number: str | None
    clinic_id: str | None

    class Config:
        from_attributes = True


class DoctorProfileUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    specialty: str | None = None
    clinic_id: str | None = None


# --------------------------- ACCESS GRANTS ---------------------------

class AccessGrantRequest(BaseModel):
    patient_email: EmailStr  # le médecin saisit l'email/identifiant du patient


class AccessGrantRespond(BaseModel):
    grant_id: str
    approve: bool


class AccessGrantOut(BaseModel):
    id: str
    patient_id: str
    doctor_id: str
    status: str
    requested_at: datetime
    expires_at: datetime | None

    class Config:
        from_attributes = True


# --------------------------- DOCUMENTS ---------------------------

class MedicalDocumentOut(BaseModel):
    id: str
    category: str
    title: str
    file_url: str
    document_date: date
    created_at: datetime

    class Config:
        from_attributes = True


# --------------------------- APPOINTMENTS ---------------------------

class AppointmentCreate(BaseModel):
    doctor_id: str
    scheduled_at: datetime
    reason: str | None = None


class AppointmentOut(BaseModel):
    id: str
    doctor_id: str
    patient_id: str
    scheduled_at: datetime
    status: str
    reason: str | None

    class Config:
        from_attributes = True

# --------------------------- CONSULTATIONS / PRESCRIPTIONS ---------------------------

class ConsultationCreate(BaseModel):
    patient_id: str
    reason: str | None = None
    notes: str | None = None


class ConsultationOut(BaseModel):
    id: str
    patient_id: str
    doctor_id: str
    consultation_date: datetime
    reason: str | None
    notes: str | None

    class Config:
        from_attributes = True


class PrescriptionCreate(BaseModel):
    medication_name: str
    dosage: str | None = None
    duration: str | None = None
    instructions: str | None = None


class PrescriptionOut(BaseModel):
    id: str
    consultation_id: str
    medication_name: str
    dosage: str | None
    duration: str | None
    instructions: str | None

    class Config:
        from_attributes = True


# --------------------------- BILLING ---------------------------

class InvoiceCreate(BaseModel):
    patient_id: str
    description: str
    amount_due: float
    consultation_id: str | None = None


class InvoiceOut(BaseModel):
    id: str
    patient_id: str
    doctor_id: str | None
    clinic_id: str | None
    consultation_id: str | None
    description: str
    amount_due: float
    status: str
    issued_at: datetime
    paid_amount: float = 0
    balance_due: float = 0


class PaymentCreate(BaseModel):
    amount: float
    method: str
    reference: str | None = None


class PaymentOut(BaseModel):
    id: str
    invoice_id: str
    amount: float
    method: str
    reference: str | None
    paid_at: datetime

    class Config:
        from_attributes = True


class RevenueSummary(BaseModel):
    period_start: date
    period_end: date
    invoiced_total: float
    collected_total: float
    outstanding_total: float
    invoice_count: int
