# routes/messaging.py
from flask import Blueprint
from flask_jwt_extended import jwt_required
from controllers.messaging_controller import MessagingController

messaging_bp = Blueprint("messaging", __name__, url_prefix="/messaging")
ctrl         = MessagingController()

@messaging_bp.get("/channels")
@jwt_required()
def get_my_channels():
    return ctrl.get_my_channels()

@messaging_bp.post("/channels/group")
@jwt_required()
def create_group():
    return ctrl.create_group()

@messaging_bp.post("/channels/dm")
@jwt_required()
def get_or_create_dm():
    return ctrl.get_or_create_dm()

@messaging_bp.post("/channels/setup")
@jwt_required()
def setup_channels():
    return ctrl.setup_channels()

@messaging_bp.post("/shifts/<int:shift_id>/thread")
@jwt_required()
def create_shift_thread(shift_id: int):
    return ctrl.create_shift_thread(shift_id)

@messaging_bp.get("/channels/<int:channel_id>/messages")
@jwt_required()
def get_messages(channel_id: int):
    return ctrl.get_messages(channel_id)

@messaging_bp.post("/channels/<int:channel_id>/messages")
@jwt_required()
def send_message(channel_id: int):
    return ctrl.send_message(channel_id)

@messaging_bp.post("/channels/<int:channel_id>/read")
@jwt_required()
def mark_read(channel_id: int):
    return ctrl.mark_read(channel_id)

@messaging_bp.get("/channels/<int:channel_id>/pinned")
@jwt_required()
def get_pinned(channel_id: int):
    return ctrl.get_pinned(channel_id)

@messaging_bp.get("/channels/<int:channel_id>/members")
@jwt_required()
def get_members(channel_id: int):
    return ctrl.get_members(channel_id)

@messaging_bp.post("/channels/<int:channel_id>/members")
@jwt_required()
def add_member(channel_id: int):
    return ctrl.add_member(channel_id)

@messaging_bp.post("/messages/<int:message_id>/pin")
@jwt_required()
def toggle_pin(message_id: int):
    return ctrl.toggle_pin(message_id)

@messaging_bp.post("/messages/<int:message_id>/react")
@jwt_required()
def toggle_reaction(message_id: int):
    return ctrl.toggle_reaction(message_id)