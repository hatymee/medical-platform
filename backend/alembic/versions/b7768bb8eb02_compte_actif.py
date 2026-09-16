"""compte actif

Revision ID: b7768bb8eb02
Revises: eedd4741d09b
Create Date: 2026-09-14 14:21:06.656005

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7768bb8eb02'
down_revision: Union[str, None] = 'eedd4741d09b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
