"""admin clinique

Revision ID: eedd4741d09b
Revises: 343e77877569
Create Date: 2026-09-09 10:14:15.270232

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'eedd4741d09b'
down_revision: Union[str, None] = '343e77877569'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('clinics', sa.Column('admin_user_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_clinics_admin_user', 'clinics', 'users', ['admin_user_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_clinics_admin_user', 'clinics', type_='foreignkey')
    op.drop_column('clinics', 'admin_user_id')