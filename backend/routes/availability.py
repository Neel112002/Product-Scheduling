# routes/availability.py
from flask import Blueprint
from controllers.availability_controller import AvailabilityController

router = Blueprint("availability", __name__, url_prefix="/availability")
ctrl = AvailabilityController()

@router.post("/")
def create_availability():
    return ctrl.create()
