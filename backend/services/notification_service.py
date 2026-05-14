# services/notification_service.py
import requests
from typing import Optional
from flask import current_app
from extensions import db
from models import Notification, AppUser


class NotificationService:

    def create(self, *, user_id, notif_type, title, body, data=None, send_push=True):
        notif = Notification(
            user_id=user_id, notif_type=notif_type,
            title=title, body=body, data=data or {},
            is_read=False, sent_push=False,
        )
        db.session.add(notif)
        db.session.commit()

        if send_push:
            user = AppUser.query.get(user_id)
            if user and user.push_token:
                self._send_expo_push(user.push_token, title, body, data or {})
                notif.sent_push = True
                db.session.commit()
        return notif

    def mark_read(self, notif_id: int, user_id: int) -> bool:
        notif = Notification.query.filter_by(notif_id=notif_id, user_id=user_id).first()
        if not notif:
            return False
        notif.is_read = True
        db.session.commit()
        return True

    def mark_all_read(self, user_id: int) -> int:
        count = Notification.query.filter_by(user_id=user_id, is_read=False).update({"is_read": True})
        db.session.commit()
        return count

    def get_for_user(self, user_id: int, limit: int = 50) -> list:
        notifs = (
            Notification.query
            .filter_by(user_id=user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit).all()
        )
        return [self._serialize(n) for n in notifs]

    def get_unread_count(self, user_id: int) -> int:
        return Notification.query.filter_by(user_id=user_id, is_read=False).count()

    def notify_location_staff(self, *, location_id, notif_type, title, body, data=None) -> int:
        from models import Employment
        emps = Employment.query.filter_by(location_id=location_id, status="active").all()
        for emp in emps:
            self.create(user_id=emp.user_id, notif_type=notif_type,
                        title=title, body=body, data=data, send_push=True)
        return len(emps)

    def _send_expo_push(self, push_token, title, body, data):
        if not push_token.startswith("ExponentPushToken"):
            return
        try:
            requests.post(
                current_app.config.get("EXPO_PUSH_URL", "https://exp.host/--/api/v2/push/send"),
                json={"to": push_token, "title": title, "body": body,
                      "data": data, "sound": "default", "badge": 1},
                headers={"Content-Type": "application/json"},
                timeout=5,
            )
        except Exception:
            current_app.logger.exception("Failed to send Expo push")

    @staticmethod
    def _serialize(n: Notification) -> dict:
        return {
            "notif_id":   n.notif_id,
            "type":       n.notif_type,
            "title":      n.title,
            "body":       n.body,
            "data":       n.data,
            "is_read":    n.is_read,
            "created_at": n.created_at.isoformat(),
        }