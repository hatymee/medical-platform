"""admin clinique

Revision ID: 5e6de18303c2
Revises: 96473010485c
Create Date: 2026-09-08 23:30:17.222021

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5e6de18303c2'
down_revision: Union[str, None] = '96473010485c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
