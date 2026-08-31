"""add medical secretaries

Revision ID: b9c2d4e51a22
Revises: a8e1b3f42c11
"""
from alembic import op
import sqlalchemy as sa

revision = "b9c2d4e51a22"
down_revision = "a8e1b3f42c11"
branch_labels = None
depends_on = None

def upgrade():
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'secretary'")
    op.create_table("secretaries", sa.Column("id", sa.UUID(), primary_key=True), sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=False, unique=True), sa.Column("clinic_id", sa.UUID(), sa.ForeignKey("clinics.id")), sa.Column("first_name", sa.String(100), nullable=False), sa.Column("last_name", sa.String(100), nullable=False))

def downgrade():
    op.drop_table("secretaries")
