"""add_calculation_history

Revision ID: a1b2c3d4e5f6
Revises: 24c75ae5e299
Create Date: 2026-04-24 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '24c75ae5e299'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'calculation_history',
        sa.Column('id',           sa.Integer(),     primary_key=True, autoincrement=True),
        sa.Column('timestamp',    sa.DateTime(),    nullable=False),
        sa.Column('cell_id',      sa.Integer(),     nullable=False),
        sa.Column('cell_nom',     sa.String(100),   nullable=False),
        sa.Column('cell_type',    sa.String(50),    nullable=True),
        sa.Column('nb_serie',     sa.Integer(),     nullable=False),
        sa.Column('nb_parallele', sa.Integer(),     nullable=False),
        sa.Column('verdict',      sa.String(10),    nullable=False),
        sa.Column('fill_pct',     sa.Float(),       nullable=True),
        sa.Column('energy_wh',    sa.Float(),       nullable=True),
        sa.Column('lifetime_yr',  sa.Float(),       nullable=True),
        sa.Column('payload_json', sa.Text(),        nullable=False),
        sa.Column('result_json',  sa.Text(),        nullable=False),
    )


def downgrade() -> None:
    op.drop_table('calculation_history')
