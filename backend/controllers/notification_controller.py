# controllers/notification_controller.py
from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity
from services.notification_service import NotificationService
from services.auth_service import AuthService

notif_svc = NotificationService()
auth_svc  = AuthService()


class NotificationController:

    def list_notifications(self):
        caller_id = int(get_jwt_identity())
        limit     = request.args.get("limit", default=50, type=int)
        notifs    = notif_svc.get_for_user(caller_id, limit=limit)
        unread    = notif_svc.get_unread_count(caller_id)
        return jsonify({"notifications": notifs, "unread_count": unread}), 200

    def mark_read(self, notif_id):
        caller_id = int(get_jwt_identity())
        if not notif_svc.mark_read(notif_id, caller_id):
            return jsonify({"error": "Notification not found"}), 404
        return jsonify({"message": "Marked as read"}), 200

    def mark_all_read(self):
        caller_id = int(get_jwt_identity())
        count = notif_svc.mark_all_read(caller_id)
        return jsonify({"message": f"{count} notifications marked as read"}), 200

    def register_push_token(self):
        caller_id  = int(get_jwt_identity())
        data       = request.get_json(silent=True) or {}
        push_token = (data.get("push_token") or "").strip()
        if not push_token:
            return jsonify({"error": "push_token is required"}), 400
        auth_svc.update_push_token(caller_id, push_token)
        return jsonify({"message": "Push token registered"}), 200