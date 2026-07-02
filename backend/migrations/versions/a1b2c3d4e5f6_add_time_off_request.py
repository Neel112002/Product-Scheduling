"""add time off request

Revision ID: a1b2c3d4e5f6
Revises: f3a1b2c4d5e6
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa

revision      = 'a1b2c3d4e5f6'
down_revision = 'f3a1b2c4d5e6'
branch_labels = None
depends_on    = None

def upgrade():
    op.create_table(
        'time_off_request',
        sa.Column('request_id',    sa.BigInteger(), primary_key=True),
        sa.Column('user_id',       sa.BigInteger(), sa.ForeignKey('app_user.user_id', ondelete='CASCADE'), nullable=False),
        sa.Column('comp_id',       sa.BigInteger(), sa.ForeignKey('company.comp_id',  ondelete='CASCADE'), nullable=False),
        sa.Column('start_date',    sa.Date(),        nullable=False),
        sa.Column('end_date',      sa.Date(),        nullable=False),
        sa.Column('request_type',  sa.Text(),        nullable=False, server_default='vacation'),
        sa.Column('reason',        sa.Text(),        nullable=True),
        sa.Column('status',        sa.Text(),        nullable=False, server_default='pending'),
        sa.Column('manager_notes', sa.Text(),        nullable=True),
        sa.Column('created_at',    sa.DateTime(),    nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at',    sa.DateTime(),    nullable=False, server_default=sa.text('NOW()')),
        sa.CheckConstraint("status IN ('pending','approved','rejected','cancelled')", name='ck_timeoff_status'),
        sa.CheckConstraint("request_type IN ('vacation','sick','personal','other')",  name='ck_timeoff_type'),
    )

def downgrade():
    op.drop_table('time_off_request')