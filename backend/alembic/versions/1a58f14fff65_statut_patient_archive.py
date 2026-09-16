"""statut patient archive

Revision ID: 1a58f14fff65
Revises: b9c2d4e51a22
Create Date: 2026-09-05 16:21:09.642014

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '1a58f14fff65'
down_revision: Union[str, None] = 'b9c2d4e51a22'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('patients', sa.Column('status', sa.String(length=20), nullable=False, server_default='active'))
    op.add_column('patients', sa.Column('status_reason', sa.Text(), nullable=True))
    op.add_column('patients', sa.Column('status_changed_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('patients', 'status_changed_at')
    op.drop_column('patients', 'status_reason')
    op.drop_column('patients', 'status')