# routes/swaps.py
from flask import Blueprint
from flask_jwt_extended import jwt_required
from controllers.swap_controller import SwapController

router = Blueprint("swaps", __name__, url_prefix="/swaps")
ctrl   = SwapController()

# ── Employee ──────────────────────────────────────────────────────────────────
@router.post("/open")
@jwt_required()
def request_open():
    return ctrl.request_open()

@router.post("/targeted")
@jwt_required()
def request_targeted():
    return ctrl.request_targeted()

@router.get("/mine")
@jwt_required()
def my_swaps():
    return ctrl.my_swaps()

@router.get("/incoming")
@jwt_required()
def incoming():
    return ctrl.incoming()

@router.get("/marketplace")
@jwt_required()
def marketplace():
    return ctrl.marketplace()

@router.get("/my-shifts")
@jwt_required()
def my_shifts_for_offer():
    return ctrl.my_shifts_for_offer()

@router.post("/<int:swap_id>/offer")
@jwt_required()
def make_offer(swap_id: int):
    return ctrl.make_offer(swap_id)

@router.post("/<int:swap_id>/retract")
@jwt_required()
def retract_offer(swap_id: int):
    return ctrl.retract_offer(swap_id)

@router.post("/<int:swap_id>/accept")
@jwt_required()
def accept(swap_id: int):
    return ctrl.accept(swap_id)

@router.post("/<int:swap_id>/reject")
@jwt_required()
def reject(swap_id: int):
    return ctrl.reject(swap_id)

@router.post("/<int:swap_id>/cancel")
@jwt_required()
def cancel(swap_id: int):
    return ctrl.cancel(swap_id)

@router.get("/colleagues")
@jwt_required()
def get_colleagues():
    return ctrl.get_colleagues()

@router.get("/colleague-shifts/<int:colleague_id>")
@jwt_required()
def colleague_shifts(colleague_id: int):
    return ctrl.get_colleague_shifts(colleague_id)

# ── Manager ───────────────────────────────────────────────────────────────────
@router.get("/pending-manager")
@jwt_required()
def pending_manager():
    return ctrl.pending_manager()

@router.post("/<int:swap_id>/decide")
@jwt_required()
def manager_decide(swap_id: int):
    return ctrl.manager_decide(swap_id)

