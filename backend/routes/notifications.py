# routes/notifications.py
from flask import Blueprint
from flask_jwt_extended import jwt_required
from controllers.notification_controller import NotificationController

router = Blueprint("notifications", __name__, url_prefix="/notifications")
ctrl   = NotificationController()

@router.get("/")
@jwt_required()
def list_notifications():
    return ctrl.list_notifications()

@router.post("/<int:notif_id>/read")
@jwt_required()
def mark_read(notif_id):
    return ctrl.mark_read(notif_id)

@router.post("/read-all")
@jwt_required()
def mark_all_read():
    return ctrl.mark_all_read()

@router.post("/push-token")
@jwt_required()
def register_push_token():
    return ctrl.register_push_token()