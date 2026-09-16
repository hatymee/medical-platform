"""admin clinique

Revision ID: 343e77877569
Revises: 5e6de18303c2
Create Date: 2026-09-08 23:32:30.361607

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '343e77877569'
down_revision: Union[str, None] = '5e6de18303c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
