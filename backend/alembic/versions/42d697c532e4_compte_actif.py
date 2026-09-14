"""compte actif

Revision ID: 42d697c532e4
Revises: b7768bb8eb02
Create Date: 2026-09-14 14:24:25.935868

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '42d697c532e4'
down_revision: Union[str, None] = 'b7768bb8eb02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass