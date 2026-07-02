"""update shift swap for exchange

Revision ID: b2c3d4e5f6a1
Revises: a1b2c3d4e5f6
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa

revision      = 'b2c3d4e5f6a1'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on    = None

def upgrade():
    op.add_column('shift_swap', sa.Column('offered_shift_id', sa.BigInteger(), nullable=True))
    op.add_column('shift_swap', sa.Column('swap_type', sa.Text(), nullable=False, server_default='open'))

    op.drop_constraint('ck_swap_status', 'shift_swap', type_='check')
    op.create_check_constraint(
        'ck_swap_status', 'shift_swap',
        "status IN ('pending','offer_pending','accepted','rejected','approved','cancelled')"
    )
    op.create_foreign_key(
        'fk_swap_offered_shift', 'shift_swap', 'shift',
        ['offered_shift_id'], ['shift_id'], ondelete='SET NULL'
    )

def downgrade():
    op.drop_constraint('fk_swap_offered_shift', 'shift_swap', type_='foreignkey')
    op.drop_constraint('ck_swap_status', 'shift_swap', type_='check')
    op.create_check_constraint(
        'ck_swap_status', 'shift_swap',
        "status IN ('pending','accepted','rejected','approved','cancelled')"
    )
    op.drop_column('shift_swap', 'swap_type')
    op.drop_column('shift_swap', 'offered_shift_id')