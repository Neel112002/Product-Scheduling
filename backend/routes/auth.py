# routes/auth.py
from flask import Blueprint
from controllers.auth_controller import AuthController
from flask_jwt_extended import jwt_required

router = Blueprint("auth", __name__, url_prefix="/auth")
auth = AuthController()

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
