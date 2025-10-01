# routes/onboarding.py
from flask import Blueprint
from controllers.onboarding_controller import OnboardingController
from flask_jwt_extended import jwt_required

router = Blueprint("onboarding", __name__, url_prefix="/onboarding")
ctrl = OnboardingController()

# Manager/Owner creates invite
@router.post("/invite")
@jwt_required()
def create_invite():
    return ctrl.create_invite()

# Public: prevalidate an invite token (for the wizard screen)
@router.get("/validate")
def prevalidate():
    return ctrl.prevalidate()

# Public: accept invite, set password, create/attach user+employment
@router.post("/accept")
def accept():
    return ctrl.accept()
