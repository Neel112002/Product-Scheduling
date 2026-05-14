# routes/admin.py
from flask import Blueprint
from flask_jwt_extended import jwt_required
from controllers.admin_controller import AdminController

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")
ctrl     = AdminController()

@admin_bp.get("/locations")
@jwt_required()
def list_locations():
    return ctrl.list_locations()

@admin_bp.get("/company")
@jwt_required()
def get_company():
    return ctrl.get_company()

@admin_bp.put("/company/plan")
@jwt_required()
def update_plan():
    return ctrl.update_plan()

@admin_bp.get("/staff")
@jwt_required()
def list_staff():
    return ctrl.list_staff()