# routes/time_entries.py
from flask import Blueprint
from flask_jwt_extended import jwt_required
from controllers.time_entry_controller import TimeEntryController

router = Blueprint("time_entries", __name__, url_prefix="/time-entries")
ctrl   = TimeEntryController()


# ── Employee ──────────────────────────────────────────────────────────────────
@router.get("/active")
@jwt_required()
def get_active():
    return ctrl.get_active()


@router.get("/")
@jwt_required()
def get_history():
    return ctrl.get_history()


@router.post("/clock-in")
@jwt_required()
def clock_in():
    return ctrl.clock_in()


@router.post("/clock-out")
@jwt_required()
def clock_out():
    return ctrl.clock_out()


@router.post("/break-start")
@jwt_required()
def start_break():
    return ctrl.start_break()


@router.post("/break-end")
@jwt_required()
def end_break():
    return ctrl.end_break()


# ── Manager ───────────────────────────────────────────────────────────────────
@router.post("/manager/clock-in")
@jwt_required()
def manager_clock_in():
    return ctrl.manager_clock_in()


@router.post("/manager/clock-out")
@jwt_required()
def manager_clock_out():
    return ctrl.manager_clock_out()


# ── Settings (owner/manager) ──────────────────────────────────────────────────
@router.get("/settings")
@jwt_required()
def get_settings():
    return ctrl.get_settings()


@router.put("/settings")
@jwt_required()
def update_settings():
    return ctrl.update_settings()


@router.post("/settings/generate-pin")
@jwt_required()
def generate_pin():
    return ctrl.generate_pin()