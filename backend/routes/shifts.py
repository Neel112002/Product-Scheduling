# routes/shifts.py
from flask import Blueprint
from flask_jwt_extended import jwt_required
from controllers.shift_controller import ShiftController

router = Blueprint("shifts", __name__, url_prefix="/shifts")
ctrl   = ShiftController()

@router.get("/")
@jwt_required()
def list_shifts():
    return ctrl.list_shifts()

@router.get("/mine")
@jwt_required()
def my_shifts():
    return ctrl.my_shifts()

@router.get("/labor-cost")
@jwt_required()
def labor_cost():
    return ctrl.labor_cost()

@router.get("/roles-with-staff")
@jwt_required()
def roles_with_staff():
    return ctrl.roles_with_staff()

@router.get("/<int:shift_id>")
@jwt_required()
def get_shift(shift_id):
    return ctrl.get_shift(shift_id)

@router.post("/")
@jwt_required()
def create_shift():
    return ctrl.create_shift()

@router.post("/bulk-week")
@jwt_required()
def bulk_create_week():
    return ctrl.bulk_create_week()

@router.put("/<int:shift_id>")
@jwt_required()
def update_shift(shift_id):
    return ctrl.update_shift(shift_id)

@router.delete("/<int:shift_id>")
@jwt_required()
def cancel_shift(shift_id):
    return ctrl.cancel_shift(shift_id)

@router.post("/<int:shift_id>/assign")
@jwt_required()
def assign_user(shift_id):
    return ctrl.assign_user(shift_id)

@router.delete("/<int:shift_id>/assign")
@jwt_required()
def unassign_user(shift_id):
    return ctrl.unassign_user(shift_id)

@router.post("/publish")
@jwt_required()
def publish_week():
    return ctrl.publish_week()