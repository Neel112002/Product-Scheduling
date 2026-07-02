# routes/availability.py
from flask import Blueprint
from flask_jwt_extended import jwt_required
from controllers.availability_controller import AvailabilityController

router = Blueprint("availability", __name__, url_prefix="/availability")
ctrl   = AvailabilityController()

@router.post("/")
@jwt_required()
def create_availability():
    return ctrl.create()

@router.get("/")
@jwt_required()
def get_availability():
    return ctrl.get_mine()

@router.delete("/<int:availability_id>")
@jwt_required()
def delete_availability(availability_id: int):
    return ctrl.delete(availability_id)