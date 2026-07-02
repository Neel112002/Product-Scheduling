"""add shift drop

Revision ID: f3a1b2c4d5e6
Revises: e4f2c8a1b3d5
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa

revision      = 'f3a1b2c4d5e6'
down_revision = 'e4f2c8a1b3d5'
branch_labels = None
depends_on    = None

def upgrade():
    op.create_table(
        'shift_drop',
        sa.Column('drop_id',    sa.BigInteger(), primary_key=True),
        sa.Column('shift_id',   sa.BigInteger(), sa.ForeignKey('shift.shift_id',   ondelete='CASCADE'), nullable=False),
        sa.Column('user_id',    sa.BigInteger(), sa.ForeignKey('app_user.user_id', ondelete='CASCADE'), nullable=False),
        sa.Column('reason',     sa.Text(),       nullable=True),
        sa.Column('status',     sa.Text(),       nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(),   nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(),   nullable=False, server_default=sa.text('NOW()')),
        sa.CheckConstraint(
            "status IN ('pending','approved','rejected','cancelled')",
            name='ck_drop_status'
        ),
    )

def downgrade():
    op.drop_table('shift_drop')