# utils/socket_events.py
from extensions import socketio


def emit_schedule_published(location_id: int, week_start: str, shift_count: int):
    socketio.emit(
        "schedule:published",
        {
            "location_id": location_id,
            "week_start":  week_start,
            "shift_count": shift_count,
            "message":     "Schedule has been published. Check your shifts!",
        },
        room=f"location:{location_id}",
    )


def emit_shift_updated(location_id: int, shift_id: int, action: str):
    socketio.emit(
        "shift:updated",
        {"shift_id": shift_id, "action": action},
        room=f"location:{location_id}",
    )


def emit_shift_assigned(user_id: int, shift_id: int, start_time: str):
    socketio.emit(
        "shift:assigned",
        {
            "shift_id":   shift_id,
            "start_time": start_time,
            "message":    f"You have been assigned a shift on {start_time}.",
        },
        room=f"user:{user_id}",
    )


def emit_swap_requested(receiving_user_id: int, swap_id: int, requester_name: str):
    socketio.emit(
        "swap:requested",
        {
            "swap_id":        swap_id,
            "requester_name": requester_name,
            "message":        f"{requester_name} wants to swap a shift with you.",
        },
        room=f"user:{receiving_user_id}",
    )


def emit_swap_status_changed(requesting_user_id: int, swap_id: int, status: str):
    messages = {
        "accepted":  "Your swap request was accepted! Waiting for manager approval.",
        "rejected":  "Your swap request was declined.",
        "approved":  "Your shift swap has been approved by the manager.",
        "cancelled": "The swap request was cancelled.",
    }
    socketio.emit(
        "swap:status_changed",
        {
            "swap_id": swap_id,
            "status":  status,
            "message": messages.get(status, f"Swap status: {status}."),
        },
        room=f"user:{requesting_user_id}",
    )


def emit_ai_schedule_ready(location_id: int, manager_user_id: int, week_start: str, shift_count: int):
    socketio.emit(
        "ai:schedule_ready",
        {
            "week_start":  week_start,
            "shift_count": shift_count,
            "message":     f"AI generated {shift_count} draft shifts for {week_start}. Ready to review.",
        },
        room=f"user:{manager_user_id}",
    )


def emit_ai_prediction(location_id: int, prediction: dict):
    socketio.emit("ai:prediction", prediction, room=f"location:{location_id}")


def emit_labor_cost_update(company_id: int, location_id: int, week_start: str, cost: float, budget: float):
    socketio.emit(
        "labor:cost_update",
        {
            "location_id": location_id,
            "week_start":  week_start,
            "cost":        round(cost, 2),
            "budget":      round(budget, 2),
            "over_budget": cost > budget,
            "percent":     round((cost / budget * 100) if budget else 0, 1),
        },
        room=f"company:{company_id}",
    )