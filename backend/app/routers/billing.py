from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.models import Doctor, Invoice, InvoiceStatus, Payment, User, RecordAccessGrant, AccessStatus
from app.schemas.schemas import InvoiceCreate, InvoiceOut, PaymentCreate, PaymentOut, RevenueSummary

router = APIRouter(prefix="/billing", tags=["billing"])


def _get_doctor(db: Session, user: User) -> Doctor | None:
    return db.query(Doctor).filter(Doctor.user_id == user.id).first()


def _doctor_has_active_access(db: Session, doctor_id: str, patient_id: str) -> bool:
    grant = (
        db.query(RecordAccessGrant)
        .filter(
            RecordAccessGrant.doctor_id == doctor_id,
            RecordAccessGrant.patient_id == patient_id,
            RecordAccessGrant.status == AccessStatus.approved,
        )
        .order_by(RecordAccessGrant.responded_at.desc())
        .first()
    )
    if not grant:
        return False
    if grant.expires_at and grant.expires_at < datetime.now(timezone.utc):
        return False
    return True


def _invoice_out(invoice: Invoice, db: Session) -> dict:
    paid = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(Payment.invoice_id == invoice.id).scalar()
    paid_amount = float(paid or 0)
    return {"id": invoice.id, "patient_id": invoice.patient_id, "doctor_id": invoice.doctor_id, "clinic_id": invoice.clinic_id, "consultation_id": invoice.consultation_id, "description": invoice.description, "amount_due": float(invoice.amount_due), "status": invoice.status.value, "issued_at": invoice.issued_at, "paid_amount": paid_amount, "balance_due": max(0, float(invoice.amount_due) - paid_amount)}


@router.post("/invoices", response_model=InvoiceOut, status_code=201)
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role("doctor", "clinic_admin"))):
    doctor = _get_doctor(db, current_user) if current_user.role == "doctor" else None
    if doctor and not _doctor_has_active_access(db, doctor.id, payload.patient_id):
        raise HTTPException(status_code=403, detail="Aucun acces autorise a ce patient")
    invoice = Invoice(patient_id=payload.patient_id, doctor_id=doctor.id if doctor else None, clinic_id=doctor.clinic_id if doctor else None, consultation_id=payload.consultation_id, description=payload.description, amount_due=payload.amount_due)
    db.add(invoice); db.commit(); db.refresh(invoice)
    return _invoice_out(invoice, db)


@router.get("/invoices/mine", response_model=list[InvoiceOut])
def my_invoices(db: Session = Depends(get_db), current_user: User = Depends(require_role("patient"))):
    invoices = db.query(Invoice).filter(Invoice.patient_id == current_user.patient.id).order_by(Invoice.issued_at.desc()).all()
    return [_invoice_out(invoice, db) for invoice in invoices]


@router.post("/invoices/{invoice_id}/payments", response_model=PaymentOut, status_code=201)
def record_payment(invoice_id: str, payload: PaymentCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role("doctor", "clinic_admin", "secretary"))):
    invoice = db.get(Invoice, invoice_id)
    if not invoice: raise HTTPException(status_code=404, detail="Facture introuvable")
    if payload.amount <= 0: raise HTTPException(status_code=400, detail="Le montant doit etre positif")
    paid = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(Payment.invoice_id == invoice.id).scalar()
    if Decimal(str(paid or 0)) + Decimal(str(payload.amount)) > Decimal(str(invoice.amount_due)):
        raise HTTPException(status_code=400, detail="Le paiement depasse le montant restant")
    payment = Payment(invoice_id=invoice.id, amount=payload.amount, method=payload.method, reference=payload.reference)
    db.add(payment); db.flush()
    total = Decimal(str(paid or 0)) + Decimal(str(payload.amount))
    invoice.status = InvoiceStatus.paid if total >= Decimal(str(invoice.amount_due)) else InvoiceStatus.partial
    db.commit(); db.refresh(payment)
    return payment


@router.get("/revenue", response_model=RevenueSummary)
def revenue_summary(start: date | None = None, end: date | None = None, db: Session = Depends(get_db), current_user: User = Depends(require_role("doctor", "clinic_admin"))):
    end = end or date.today(); start = start or (end - timedelta(days=29))
    start_at = datetime.combine(start, time.min, tzinfo=timezone.utc); end_at = datetime.combine(end + timedelta(days=1), time.min, tzinfo=timezone.utc)
    invoices = db.query(Invoice).filter(Invoice.issued_at >= start_at, Invoice.issued_at < end_at)
    if current_user.role == "doctor":
        doctor = _get_doctor(db, current_user)
        invoices = invoices.filter(Invoice.doctor_id == doctor.id)
    rows = invoices.all(); invoice_ids = [row.id for row in rows]
    collected = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(Payment.invoice_id.in_(invoice_ids)).scalar() if invoice_ids else 0
    invoiced = sum(float(row.amount_due) for row in rows); collected_total = float(collected or 0)
    return RevenueSummary(period_start=start, period_end=end, invoiced_total=invoiced, collected_total=collected_total, outstanding_total=max(0, invoiced - collected_total), invoice_count=len(rows))
