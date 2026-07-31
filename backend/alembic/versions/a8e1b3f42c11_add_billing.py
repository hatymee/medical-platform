"""add billing tables

Revision ID: a8e1b3f42c11
Revises: c5f2cacffa36
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a8e1b3f42c11"
down_revision = "c5f2cacffa36"
branch_labels = None
depends_on = None

def upgrade():
    status = postgresql.ENUM("unpaid", "partial", "paid", "cancelled", name="invoicestatus", create_type=False)
    postgresql.ENUM("unpaid", "partial", "paid", "cancelled", name="invoicestatus").create(op.get_bind(), checkfirst=True)
    op.create_table("invoices", sa.Column("id", sa.UUID(), primary_key=True), sa.Column("patient_id", sa.UUID(), sa.ForeignKey("patients.id"), nullable=False), sa.Column("doctor_id", sa.UUID(), sa.ForeignKey("doctors.id")), sa.Column("clinic_id", sa.UUID(), sa.ForeignKey("clinics.id")), sa.Column("consultation_id", sa.UUID(), sa.ForeignKey("consultations.id")), sa.Column("description", sa.String(255), nullable=False), sa.Column("amount_due", sa.Numeric(12, 2), nullable=False), sa.Column("status", status, nullable=False, server_default="unpaid"), sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")))
    op.create_table("payments", sa.Column("id", sa.UUID(), primary_key=True), sa.Column("invoice_id", sa.UUID(), sa.ForeignKey("invoices.id"), nullable=False), sa.Column("amount", sa.Numeric(12, 2), nullable=False), sa.Column("method", sa.String(30), nullable=False), sa.Column("reference", sa.String(100)), sa.Column("paid_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")))
    op.create_index("ix_invoices_patient", "invoices", ["patient_id"])
    op.create_index("ix_payments_invoice", "payments", ["invoice_id"])

def downgrade():
    op.drop_index("ix_payments_invoice", table_name="payments"); op.drop_index("ix_invoices_patient", table_name="invoices")
    op.drop_table("payments"); op.drop_table("invoices")
    sa.Enum(name="invoicestatus").drop(op.get_bind(), checkfirst=True)
