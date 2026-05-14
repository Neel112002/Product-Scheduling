from flask import Blueprint
from flask_jwt_extended import jwt_required
from controllers.auth_controller import AuthController
from controllers.password_flow_controller import PasswordFlowController

# Blueprint for /auth endpoints
router = Blueprint("auth", __name__, url_prefix="/auth")

auth = AuthController()
pwd = PasswordFlowController()

# ---------- AUTH CORE ----------
@router.post("/register")
def register():
    return auth.register()

@router.post("/login")
def login():
    return auth.login()

@router.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    return auth.refresh()

@router.get("/me")
@jwt_required()
def me():
    return auth.me()

@router.post("/logout")
@jwt_required(refresh=True)
def logout():
    return auth.logout()


# ---------- PASSWORD FLOWS ----------
@router.post("/forgot-password")
def forgot_password():
    return pwd.forgot_password()

# Serve reset form (when user clicks the email link)
@router.get("/forgot-password/confirm")
def forgot_password_confirm_page():
    return pwd.forgot_password_confirm_page()

# API to submit new password (JSON or form)
@router.post("/forgot-password/confirm")
def forgot_password_confirm():
    return pwd.forgot_password_confirm()

# Change password (in-app, JWT required)
@router.post("/change-password")
@jwt_required()
def change_password():
    return pwd.change_password()

@router.get("/verify-email")
def verify_email():
    return auth.verify_email()

@router.patch("/profile")
@jwt_required()
def update_profile():
    return auth.update_profile()