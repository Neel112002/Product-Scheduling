# routes/auth.py
from flask import Blueprint
from controllers.auth_controller import AuthController
from flask_jwt_extended import jwt_required
from controllers.password_flow_controller import PasswordFlowController

router = Blueprint("auth", __name__, url_prefix="/auth")
auth = AuthController()


pwd = PasswordFlowController()

# Wizard Registration (Owner -> Company -> Location)
@router.post("/register")
def register():
    return auth.register()

# Login
@router.post("/login")
def login():
    return auth.login()

# Refresh token
@router.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    return auth.refresh()

# Current user
@router.get("/me")
@jwt_required()
def me():
    return auth.me()

@router.post("/forgot-password")
def forgot_password():
    return pwd.forgot_password()

@router.post("/forgot-password/confirm")
def forgot_password_confirm():
    return pwd.forgot_password_confirm()

@router.post("/change-password")
def change_password():
    return pwd.change_password()