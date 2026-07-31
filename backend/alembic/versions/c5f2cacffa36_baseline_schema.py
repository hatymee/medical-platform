"""baseline schema

Revision ID: c5f2cacffa36
Revises:
Create Date: 2026-07-26 11:22:03.854905

Cette migration ne fait rien volontairement : elle sert de point de depart
("baseline") pour une base deja creee manuellement via database/schema.sql.
Ne PAS lancer `alembic upgrade head` dessus -- utiliser `alembic stamp head`
pour marquer la base comme etant a cette revision sans rien executer.
Toute evolution future du schema passera par `alembic revision --autogenerate`.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5f2cacffa36'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
