# routes/sockets.py
from flask_socketio import join_room, leave_room, emit
from flask_jwt_extended import decode_token
from extensions import socketio
from models import AppUser


def register_socket_handlers():

    @socketio.on("connect")
    def handle_connect(auth):
        token = (auth or {}).get("token", "")
        if not token:
            return False
        try:
            decoded = decode_token(token)
            user_id = int(decoded.get("sub", 0))
            if not AppUser.query.get(user_id):
                return False
        except Exception:
            return False
        join_room(f"user:{user_id}")
        emit("connected", {"message": "Connected to real-time updates", "user_id": user_id})
        return True

    @socketio.on("join")
    def handle_join(data):
        location_id = data.get("location_id")
        company_id  = data.get("company_id")
        if location_id:
            join_room(f"location:{location_id}")
            emit("room_joined", {"room": f"location:{location_id}"})
        if company_id:
            join_room(f"company:{company_id}")
            emit("room_joined", {"room": f"company:{company_id}"})

    @socketio.on("leave")
    def handle_leave(data):
        if data.get("location_id"):
            leave_room(f"location:{data['location_id']}")
        if data.get("company_id"):
            leave_room(f"company:{data['company_id']}")

    @socketio.on("disconnect")
    def handle_disconnect():
        pass

    @socketio.on("ping_server")
    def handle_ping():
        emit("pong_server", {"status": "ok"})
        
    # ── Messaging ─────────────────────────────────────────────────────────────

    @socketio.on("messaging:join")
    def handle_messaging_join(data):
        """Join socket rooms for all user's channels."""
        for channel_id in data.get("channel_ids", []):
            join_room(f"channel_{channel_id}")

    @socketio.on("messaging:leave")
    def handle_messaging_leave(data):
        channel_id = data.get("channel_id")
        if channel_id:
            leave_room(f"channel_{channel_id}")

    @socketio.on("typing:start")
    def handle_typing_start(data):
        channel_id = data.get("channel_id")
        user_name  = data.get("user_name", "Someone")
        if channel_id:
            emit("typing", {
                "channel_id": channel_id,
                "user_name":  user_name,
                "is_typing":  True,
            }, room=f"channel_{channel_id}", include_self=False)

    @socketio.on("typing:stop")
    def handle_typing_stop(data):
        channel_id = data.get("channel_id")
        if channel_id:
            emit("typing", {
                "channel_id": channel_id,
                "user_name":  data.get("user_name", "Someone"),
                "is_typing":  False,
            }, room=f"channel_{channel_id}", include_self=False)