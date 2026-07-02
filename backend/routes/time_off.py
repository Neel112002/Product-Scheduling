# routes/time_off.py
from flask import Blueprint
from flask_jwt_extended import jwt_required
from controllers.time_off_controller import TimeOffController

time_off_bp = Blueprint("time_off", __name__, url_prefix="/time-off")
ctrl        = TimeOffController()

@time_off_bp.post("/")
@jwt_required()
def create():
    return ctrl.create()

@time_off_bp.get("/mine")
@jwt_required()
def my_requests():
    return ctrl.my_requests()

@time_off_bp.post("/<int:request_id>/cancel")
@jwt_required()
def cancel(request_id: int):
    return ctrl.cancel(request_id)

@time_off_bp.get("/pending")
@jwt_required()
def pending():
    return ctrl.pending()

@time_off_bp.post("/<int:request_id>/decide")
@jwt_required()
def decide(request_id: int):
    return ctrl.decide(request_id)