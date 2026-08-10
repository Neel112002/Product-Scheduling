# services/messaging_service.py
import re
from datetime import datetime
from extensions import db
from models import (
    Channel, ChannelMember, Message, MessageRead, MessageReaction,
    AppUser, Employment, Role, Shift, ShiftAssignment,
)
from services.notification_service import NotificationService

notif_svc = NotificationService()


class MessagingService:

    # ── Channel setup ─────────────────────────────────────────────────────────

    def setup_location_channels(self, location_id: int, created_by: int = None):
        """Create #general + one channel per role for a location."""
        existing = Channel.query.filter_by(location_id=location_id, channel_type='general').first()
        if existing:
            return existing

        general = Channel(
            name='general',
            channel_type='general',
            location_id=location_id,
            created_by=created_by,
            description='General channel for all team members',
        )
        db.session.add(general)
        db.session.flush()

        emps = Employment.query.filter_by(location_id=location_id, status='active').all()
        for emp in emps:
            is_admin = emp.role and emp.role.name.lower() in ('owner', 'manager')
            db.session.add(ChannelMember(
                channel_id=general.channel_id,
                user_id=emp.user_id,
                is_admin=is_admin,
            ))

        roles = Role.query.filter_by(location_id=location_id).all()
        for role in roles:
            self._create_role_channel(location_id, role, created_by)

        db.session.commit()
        return general

    def _create_role_channel(self, location_id: int, role: Role, created_by: int = None):
        existing = Channel.query.filter_by(location_id=location_id, role_id=role.role_id).first()
        if existing:
            return existing

        channel = Channel(
            name=role.name.lower(),
            channel_type='role',
            location_id=location_id,
            created_by=created_by,
            role_id=role.role_id,
            description=f'Channel for all {role.name}s',
        )
        db.session.add(channel)
        db.session.flush()

        emps = Employment.query.filter_by(
            location_id=location_id, role_id=role.role_id, status='active'
        ).all()
        for emp in emps:
            db.session.add(ChannelMember(channel_id=channel.channel_id, user_id=emp.user_id))

        return channel

    def add_user_to_location_channels(self, user_id: int, location_id: int, role_id: int = None):
        """Add a new employee to general + their role channel."""
        general = Channel.query.filter_by(location_id=location_id, channel_type='general').first()
        if general:
            if not ChannelMember.query.filter_by(channel_id=general.channel_id, user_id=user_id).first():
                db.session.add(ChannelMember(channel_id=general.channel_id, user_id=user_id))

        if role_id:
            role_ch = Channel.query.filter_by(location_id=location_id, role_id=role_id, channel_type='role').first()
            if role_ch:
                if not ChannelMember.query.filter_by(channel_id=role_ch.channel_id, user_id=user_id).first():
                    db.session.add(ChannelMember(channel_id=role_ch.channel_id, user_id=user_id))

        db.session.commit()

    # ── DM ────────────────────────────────────────────────────────────────────

    def get_or_create_dm(self, user_id_a: int, user_id_b: int) -> Channel:
        if user_id_a == user_id_b:
            raise ValueError("Cannot DM yourself.")

        candidates = (
            db.session.query(Channel)
            .join(ChannelMember, ChannelMember.channel_id == Channel.channel_id)
            .filter(Channel.channel_type == 'direct', ChannelMember.user_id == user_id_a)
            .all()
        )
        for ch in candidates:
            member_ids = {m.user_id for m in ch.members}
            if member_ids == {user_id_a, user_id_b}:
                return ch

        user_a = AppUser.query.get(user_id_a)
        user_b = AppUser.query.get(user_id_b)
        name_a = user_a.display_name or user_a.username if user_a else str(user_id_a)
        name_b = user_b.display_name or user_b.username if user_b else str(user_id_b)

        channel = Channel(
            name=f'{name_a} & {name_b}',
            channel_type='direct',
            created_by=user_id_a,
        )
        db.session.add(channel)
        db.session.flush()
        db.session.add(ChannelMember(channel_id=channel.channel_id, user_id=user_id_a))
        db.session.add(ChannelMember(channel_id=channel.channel_id, user_id=user_id_b))
        db.session.commit()
        return channel

    # ── Group ─────────────────────────────────────────────────────────────────

    def create_group(
        self, *,
        name: str,
        member_ids: list,
        creator_id: int,
        location_id: int,
        is_broadcast: bool = False,
        description: str = None,
    ) -> Channel:
        channel = Channel(
            name=name,
            channel_type='broadcast' if is_broadcast else 'group',
            location_id=location_id,
            created_by=creator_id,
            is_broadcast=is_broadcast,
            description=description,
        )
        db.session.add(channel)
        db.session.flush()

        all_members = set(member_ids) | {creator_id}
        for uid in all_members:
            db.session.add(ChannelMember(
                channel_id=channel.channel_id,
                user_id=uid,
                is_admin=(uid == creator_id),
            ))

        db.session.commit()

        self._system_message(channel.channel_id,
            f"{'📢 Broadcast channel' if is_broadcast else '👥 Group'} created by "
            f"{self._user_name(creator_id)}.")
        return channel

    # ── Shift thread ──────────────────────────────────────────────────────────

    def create_shift_thread(self, shift_id: int, creator_id: int) -> Channel:
        existing = Channel.query.filter_by(shift_id=shift_id, channel_type='shift').first()
        if existing:
            return existing

        shift = Shift.query.get(shift_id)
        if not shift:
            raise ValueError("Shift not found.")

        name = f"Shift {shift.start_time.strftime('%b %d %I:%M %p')}"
        if shift.role:
            name += f" · {shift.role.name}"

        channel = Channel(
            name=name,
            channel_type='shift',
            location_id=shift.location_id,
            created_by=creator_id,
            shift_id=shift_id,
            description=f"Discussion thread for {name}",
        )
        db.session.add(channel)
        db.session.flush()

        assignments = ShiftAssignment.query.filter_by(shift_id=shift_id).all()
        added = set()
        for a in assignments:
            db.session.add(ChannelMember(channel_id=channel.channel_id, user_id=a.user_id))
            added.add(a.user_id)

        if creator_id not in added:
            db.session.add(ChannelMember(
                channel_id=channel.channel_id, user_id=creator_id, is_admin=True
            ))

        db.session.commit()
        self._system_message(channel.channel_id, f"📋 Shift thread created for {name}.")
        return channel

    # ── Messages ──────────────────────────────────────────────────────────────

    def send_message(
        self, *,
        channel_id: int,
        sender_id: int,
        content: str,
        reply_to_id: int = None,
    ) -> Message:
        channel = self._get_channel(channel_id)
        member  = ChannelMember.query.filter_by(channel_id=channel_id, user_id=sender_id).first()
        if not member:
            raise PermissionError("You are not a member of this channel.")
        if channel.is_broadcast and not member.is_admin:
            raise PermissionError("Only managers can post in broadcast channels.")

        if reply_to_id:
            reply = Message.query.get(reply_to_id)
            if not reply or reply.channel_id != channel_id:
                reply_to_id = None

        msg = Message(
            channel_id=channel_id,
            sender_id=sender_id,
            content=content.strip(),
            reply_to_id=reply_to_id,
        )
        db.session.add(msg)
        db.session.commit()

        self._handle_mentions(msg, channel)
        return msg

    def get_messages(self, channel_id: int, user_id: int, before_id: int = None, limit: int = 50):
        if not ChannelMember.query.filter_by(channel_id=channel_id, user_id=user_id).first():
            raise PermissionError("Not a member of this channel.")

        q = Message.query.filter_by(channel_id=channel_id)
        if before_id:
            q = q.filter(Message.message_id < before_id)
        msgs = q.order_by(Message.created_at.desc()).limit(limit).all()
        return list(reversed(msgs))

    def get_channels_for_user(self, user_id: int) -> list:
        memberships = ChannelMember.query.filter_by(user_id=user_id).all()
        result = []
        for m in memberships:
            channel = m.channel
            if not channel:
                continue

            last_read = m.last_read_at
            if last_read:
                unread = Message.query.filter(
                    Message.channel_id == channel.channel_id,
                    Message.sender_id  != user_id,
                    Message.created_at > last_read,
                    Message.is_deleted == False,
                ).count()
            else:
                unread = Message.query.filter(
                    Message.channel_id == channel.channel_id,
                    Message.sender_id  != user_id,
                    Message.is_deleted == False,
                ).count()

            last_msg = Message.query.filter_by(
                channel_id=channel.channel_id
            ).order_by(Message.created_at.desc()).first()

            result.append({
                "channel":  channel,
                "unread":   unread,
                "last_msg": last_msg,
                "is_admin": m.is_admin,
            })

        result.sort(
            key=lambda x: x["last_msg"].created_at if x["last_msg"] else x["channel"].created_at,
            reverse=True,
        )
        return result

    # ── Pin ───────────────────────────────────────────────────────────────────

    def toggle_pin(self, message_id: int, user_id: int) -> Message:
        msg    = self._get_message(message_id)
        member = ChannelMember.query.filter_by(channel_id=msg.channel_id, user_id=user_id).first()
        if not member or not member.is_admin:
            raise PermissionError("Only channel admins can pin messages.")
        msg.is_pinned = not msg.is_pinned
        db.session.commit()
        return msg

    def get_pinned(self, channel_id: int, user_id: int):
        if not ChannelMember.query.filter_by(channel_id=channel_id, user_id=user_id).first():
            raise PermissionError("Not a member.")
        return Message.query.filter_by(
            channel_id=channel_id, is_pinned=True, is_deleted=False
        ).order_by(Message.created_at.desc()).all()

    # ── Reactions ─────────────────────────────────────────────────────────────

    def toggle_reaction(self, message_id: int, user_id: int, emoji: str) -> bool:
        existing = MessageReaction.query.filter_by(
            message_id=message_id, user_id=user_id, emoji=emoji
        ).first()
        if existing:
            db.session.delete(existing)
            db.session.commit()
            return False
        db.session.add(MessageReaction(message_id=message_id, user_id=user_id, emoji=emoji))
        db.session.commit()
        return True

    # ── Read ──────────────────────────────────────────────────────────────────

    def mark_read(self, channel_id: int, user_id: int):
        member = ChannelMember.query.filter_by(channel_id=channel_id, user_id=user_id).first()
        if member:
            member.last_read_at = datetime.utcnow()
            db.session.commit()

    # ── Members ───────────────────────────────────────────────────────────────

    def add_member(self, channel_id: int, user_id: int, added_by: int):
        channel = self._get_channel(channel_id)
        if channel.channel_type not in ('group', 'broadcast'):
            raise ValueError("Can only add members to groups.")
        adder = ChannelMember.query.filter_by(channel_id=channel_id, user_id=added_by).first()
        if not adder or not adder.is_admin:
            raise PermissionError("Only admins can add members.")
        if ChannelMember.query.filter_by(channel_id=channel_id, user_id=user_id).first():
            raise ValueError("User is already a member.")
        db.session.add(ChannelMember(channel_id=channel_id, user_id=user_id))
        db.session.commit()

    def get_members(self, channel_id: int, user_id: int):
        if not ChannelMember.query.filter_by(channel_id=channel_id, user_id=user_id).first():
            raise PermissionError("Not a member.")
        return ChannelMember.query.filter_by(channel_id=channel_id).all()

    # ── Serialization ─────────────────────────────────────────────────────────

    def serialize_channel(self, channel: Channel, user_id: int,
                          unread: int = 0, last_msg: Message = None) -> dict:
        name = channel.name
        if channel.channel_type == 'direct':
            others = [m for m in channel.members if m.user_id != user_id]
            if others and others[0].user:
                name = others[0].user.display_name or others[0].user.username

        return {
            "channel_id":   channel.channel_id,
            "name":         name,
            "channel_type": channel.channel_type,
            "is_broadcast": channel.is_broadcast,
            "description":  channel.description,
            "location_id":  channel.location_id,
            "shift_id":     channel.shift_id,
            "unread":       unread,
            "member_count": len(channel.members),
            "last_message": self.serialize_message(last_msg, user_id) if last_msg else None,
        }

    def serialize_message(self, msg: Message, viewer_id: int) -> dict | None:
        if not msg:
            return None

        sender = AppUser.query.get(msg.sender_id) if msg.sender_id else None

        reaction_map: dict = {}
        for r in msg.reactions:
            if r.emoji not in reaction_map:
                reaction_map[r.emoji] = {"emoji": r.emoji, "count": 0, "mine": False}
            reaction_map[r.emoji]["count"] += 1
            if r.user_id == viewer_id:
                reaction_map[r.emoji]["mine"] = True

        reply_preview = None
        if msg.reply_to_id and msg.reply_to:
            rt        = msg.reply_to
            rt_sender = AppUser.query.get(rt.sender_id) if rt.sender_id else None
            reply_preview = {
                "message_id":  rt.message_id,
                "content":     rt.content[:80] if not rt.is_deleted else "[deleted]",
                "sender_name": (rt_sender.display_name or rt_sender.username) if rt_sender else "Unknown",
            }

        return {
            "message_id":      msg.message_id,
            "channel_id":      msg.channel_id,
            "content":         "[deleted]" if msg.is_deleted else msg.content,
            "is_deleted":      msg.is_deleted,
            "is_pinned":       msg.is_pinned,
            "sender_id":       msg.sender_id,
            "sender_name":     (sender.display_name or sender.username) if sender else "System",
            "sender_initials": self._initials(sender) if sender else "•",
            "is_mine":         msg.sender_id == viewer_id,
            "reply_to":        reply_preview,
            "reactions":       list(reaction_map.values()),
            "read_count":      len(msg.reads),
            "created_at":      msg.created_at.isoformat(),
            "updated_at":      msg.updated_at.isoformat(),
        }

    # ── Private helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _get_channel(channel_id: int) -> Channel:
        ch = Channel.query.get(channel_id)
        if not ch:
            raise ValueError("Channel not found.")
        return ch

    @staticmethod
    def _get_message(message_id: int) -> Message:
        msg = Message.query.get(message_id)
        if not msg:
            raise ValueError("Message not found.")
        return msg

    @staticmethod
    def _initials(user: AppUser) -> str:
        name  = user.display_name or user.username or "?"
        parts = name.strip().split()
        return "".join(p[0].upper() for p in parts[:2])

    @staticmethod
    def _user_name(user_id: int) -> str:
        u = AppUser.query.get(user_id)
        return u.display_name or u.username if u else "Unknown"

    def _system_message(self, channel_id: int, content: str):
        db.session.add(Message(channel_id=channel_id, sender_id=None, content=content))
        db.session.commit()

    def _handle_mentions(self, msg: Message, channel: Channel):
        mentions = re.findall(r'@(\w+)', msg.content)
        if not mentions:
            return

        sender_name = self._user_name(msg.sender_id)
        notified    = set()

        for mention in mentions:
            user = AppUser.query.filter(AppUser.username.ilike(mention)).first()
            if user and user.user_id != msg.sender_id and user.user_id not in notified:
                notified.add(user.user_id)
                notif_svc.create(
                    user_id=user.user_id,
                    notif_type="mention",
                    title=f"{sender_name} mentioned you",
                    body=msg.content[:100],
                    data={"channel_id": msg.channel_id, "message_id": msg.message_id},
                )
                continue

            if channel.location_id:
                role = Role.query.filter(
                    Role.location_id == channel.location_id,
                    Role.name.ilike(mention),
                ).first()
                if role:
                    for emp in Employment.query.filter_by(role_id=role.role_id, status="active").all():
                        if emp.user_id != msg.sender_id and emp.user_id not in notified:
                            notified.add(emp.user_id)
                            notif_svc.create(
                                user_id=emp.user_id,
                                notif_type="mention",
                                title=f"{sender_name} mentioned @{mention}",
                                body=msg.content[:100],
                                data={"channel_id": msg.channel_id, "message_id": msg.message_id},
                            )