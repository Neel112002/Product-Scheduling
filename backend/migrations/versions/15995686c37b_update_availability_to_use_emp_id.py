"""update availability to use emp_id

Revision ID: 15995686c37b
Revises: 7d32e2e9c7ee
Create Date: 2025-10-15 13:18:50.420492
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '15995686c37b'
down_revision = '7d32e2e9c7ee'
branch_labels = None
depends_on = None


def upgrade():
    # Step 1: Add emp_id as nullable first
    with op.batch_alter_table('availability', schema=None) as batch_op:
        batch_op.add_column(sa.Column('emp_id', sa.BigInteger(), nullable=True))

    # Step 2: Create foreign key constraint to employment
    with op.batch_alter_table('availability', schema=None) as batch_op:
        batch_op.create_foreign_key(
            'fk_availability_emp_id_employment',
            'employment',
            ['emp_id'],
            ['emp_id'],
            ondelete='CASCADE'
        )

    # Step 3: Drop old constraints and columns
    with op.batch_alter_table('availability', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('fk_availability_location_id_location'), type_='foreignkey')
        batch_op.drop_constraint(batch_op.f('fk_availability_user_id_app_user'), type_='foreignkey')
        batch_op.drop_column('user_id')
        batch_op.drop_column('location_id')

    # Step 4: If needed, backfill emp_id for existing rows
    # NOTE: Replace "1" with an actual emp_id if you have a known mapping
    op.execute("UPDATE availability SET emp_id = 1 WHERE emp_id IS NULL;")

    # Step 5: Make emp_id NOT NULL
    with op.batch_alter_table('availability', schema=None) as batch_op:
        batch_op.alter_column('emp_id', existing_type=sa.BigInteger(), nullable=False)


def downgrade():
    with op.batch_alter_table('availability', schema=None) as batch_op:
        batch_op.add_column(sa.Column('location_id', sa.BIGINT(), autoincrement=False, nullable=False))
        batch_op.add_column(sa.Column('user_id', sa.BIGINT(), autoincrement=False, nullable=False))
        batch_op.drop_constraint('fk_availability_emp_id_employment', type_='foreignkey')
        batch_op.create_foreign_key(batch_op.f('fk_availability_user_id_app_user'), 'app_user', ['user_id'], ['user_id'], ondelete='CASCADE')
        batch_op.create_foreign_key(batch_op.f('fk_availability_location_id_location'), 'location', ['location_id'], ['loc_id'], ondelete='CASCADE')
        batch_op.drop_column('emp_id')
