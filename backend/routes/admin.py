# routes/admin.py
from flask             import Blueprint
from flask_jwt_extended import jwt_required
from controllers.admin_controller import AdminController

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")
admin    = AdminController()


# ── Locations ─────────────────────────────────────────────────────────────────
@admin_bp.get("/locations")
@jwt_required()
def list_locations():
    return admin.list_locations()


# ── Company ───────────────────────────────────────────────────────────────────
@admin_bp.get("/company")
@jwt_required()
def get_company():
    return admin.get_company()


@admin_bp.put("/company/plan")
@jwt_required()
def update_plan():
    return admin.update_plan()


# ── Staff ─────────────────────────────────────────────────────────────────────
@admin_bp.get("/staff")
@jwt_required()
def list_staff():
    return admin.list_staff()


# ── Employee profile ──────────────────────────────────────────────────────────
@admin_bp.get("/staff/<int:user_id>/profile")
@jwt_required()
def get_employee_profile(user_id: int):
    return admin.get_employee_profile(user_id)


@admin_bp.put("/staff/<int:user_id>/profile")
@jwt_required()
def update_employee_profile(user_id: int):
    return admin.update_employee_profile(user_id)