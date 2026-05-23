"""add location gps coords

Revision ID: e4f2c8a1b3d5
Revises: d1126c781da6
Create Date: 2026-05-19
"""
from alembic import op
import sqlalchemy as sa

revision = 'e4f2c8a1b3d5'
down_revision = 'd1126c781da6'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('location', sa.Column('loc_lat', sa.Float(), nullable=True))
    op.add_column('location', sa.Column('loc_lng', sa.Float(), nullable=True))

def downgrade():
    op.drop_column('location', 'loc_lng')
    op.drop_column('location', 'loc_lat')