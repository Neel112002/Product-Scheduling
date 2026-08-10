# routes/drops.py
from flask import Blueprint
from flask_jwt_extended import jwt_required
from controllers.drop_controller import DropController

drops_bp = Blueprint("drops", __name__, url_prefix="/drops")
ctrl     = DropController()


@drops_bp.post("/")
@jwt_required()
def request_drop():
    return ctrl.request_drop()

@drops_bp.get("/mine")
@jwt_required()
def my_drops():
    return ctrl.my_drops()

@drops_bp.post("/<int:drop_id>/cancel")
@jwt_required()
def cancel_drop(drop_id: int):
    return ctrl.cancel_drop(drop_id)

@drops_bp.get("/pending")
@jwt_required()
def pending_drops():
    return ctrl.pending_drops()

@drops_bp.post("/<int:drop_id>/decide")
@jwt_required()
def decide_drop(drop_id: int):
    return ctrl.decide_drop(drop_id)