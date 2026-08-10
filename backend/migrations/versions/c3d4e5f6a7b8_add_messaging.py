"""add messaging

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a1
Create Date: 2026-07-08
"""
from alembic import op
import sqlalchemy as sa

revision      = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a1'
branch_labels = None
depends_on    = None


def upgrade():
    op.create_table(
        'channel',
        sa.Column('channel_id',   sa.BigInteger(), primary_key=True),
        sa.Column('name',         sa.Text(),        nullable=False),
        sa.Column('channel_type', sa.Text(),        nullable=False, server_default='general'),
        sa.Column('location_id',  sa.BigInteger(),  sa.ForeignKey('location.loc_id',  ondelete='CASCADE'),  nullable=True),
        sa.Column('created_by',   sa.BigInteger(),  sa.ForeignKey('app_user.user_id', ondelete='SET NULL'), nullable=True),
        sa.Column('role_id',      sa.BigInteger(),  sa.ForeignKey('role.role_id',     ondelete='CASCADE'),  nullable=True),
        sa.Column('shift_id',     sa.BigInteger(),  sa.ForeignKey('shift.shift_id',   ondelete='CASCADE'),  nullable=True),
        sa.Column('is_broadcast', sa.Boolean(),     nullable=False, server_default='false'),
        sa.Column('description',  sa.Text(),        nullable=True),
        sa.Column('created_at',   sa.DateTime(),    nullable=False, server_default=sa.text('NOW()')),
        sa.CheckConstraint(
            "channel_type IN ('general','role','group','direct','broadcast','shift')",
            name='ck_channel_type'
        ),
    )

    op.create_table(
        'channel_member',
        sa.Column('channel_id',   sa.BigInteger(), sa.ForeignKey('channel.channel_id', ondelete='CASCADE'), primary_key=True),
        sa.Column('user_id',      sa.BigInteger(), sa.ForeignKey('app_user.user_id',   ondelete='CASCADE'), primary_key=True),
        sa.Column('is_admin',     sa.Boolean(),    nullable=False, server_default='false'),
        sa.Column('joined_at',    sa.DateTime(),   nullable=False, server_default=sa.text('NOW()')),
        sa.Column('last_read_at', sa.DateTime(),   nullable=True),
    )

    op.create_table(
        'message',
        sa.Column('message_id',  sa.BigInteger(), primary_key=True),
        sa.Column('channel_id',  sa.BigInteger(), sa.ForeignKey('channel.channel_id', ondelete='CASCADE'),  nullable=False),
        sa.Column('sender_id',   sa.BigInteger(), sa.ForeignKey('app_user.user_id',   ondelete='SET NULL'), nullable=True),
        sa.Column('content',     sa.Text(),       nullable=False),
        sa.Column('is_pinned',   sa.Boolean(),    nullable=False, server_default='false'),
        sa.Column('reply_to_id', sa.BigInteger(), sa.ForeignKey('message.message_id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_deleted',  sa.Boolean(),    nullable=False, server_default='false'),
        sa.Column('created_at',  sa.DateTime(),   nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at',  sa.DateTime(),   nullable=False, server_default=sa.text('NOW()')),
    )

    op.create_table(
        'message_read',
        sa.Column('message_id', sa.BigInteger(), sa.ForeignKey('message.message_id', ondelete='CASCADE'), primary_key=True),
        sa.Column('user_id',    sa.BigInteger(), sa.ForeignKey('app_user.user_id',   ondelete='CASCADE'), primary_key=True),
        sa.Column('read_at',    sa.DateTime(),   nullable=False, server_default=sa.text('NOW()')),
    )

    op.create_table(
        'message_reaction',
        sa.Column('reaction_id', sa.BigInteger(), primary_key=True),
        sa.Column('message_id',  sa.BigInteger(), sa.ForeignKey('message.message_id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id',     sa.BigInteger(), sa.ForeignKey('app_user.user_id',   ondelete='CASCADE'), nullable=False),
        sa.Column('emoji',       sa.Text(),       nullable=False),
        sa.Column('created_at',  sa.DateTime(),   nullable=False, server_default=sa.text('NOW()')),
        sa.UniqueConstraint('message_id', 'user_id', 'emoji', name='uq_reaction'),
    )


def downgrade():
    op.drop_table('message_reaction')
    op.drop_table('message_read')
    op.drop_table('message')
    op.drop_table('channel_member')
    op.drop_table('channel')