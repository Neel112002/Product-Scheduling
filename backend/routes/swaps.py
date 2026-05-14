# routes/swaps.py
from flask import Blueprint
from flask_jwt_extended import jwt_required
from controllers.swap_controller import SwapController

router = Blueprint("swaps", __name__, url_prefix="/swaps")
ctrl   = SwapController()

@router.post("/")
@jwt_required()
def request_swap():
    return ctrl.request_swap()

@router.get("/")
@jwt_required()
def my_swaps():
    return ctrl.my_swaps()

@router.get("/pending")
@jwt_required()
def pending_swaps():
    return ctrl.pending_swaps()

@router.post("/<int:swap_id>/accept")
@jwt_required()
def accept_swap(swap_id):
    return ctrl.accept_swap(swap_id)

@router.post("/<int:swap_id>/reject")
@jwt_required()
def reject_swap(swap_id):
    return ctrl.reject_swap(swap_id)

@router.post("/<int:swap_id>/approve")
@jwt_required()
def manager_approve(swap_id):
    return ctrl.manager_approve(swap_id)