# routes/admin.py
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import AppUser, Employment, Location

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")


@admin_bp.get("/locations")
@jwt_required()
def list_locations():
    """
    Returns all locations for the authenticated user's company.
    RBAC: only 'owner' and 'manager' roles are allowed.

    Response:
      { "locations": [ { "id": loc_id, "name": loc_name }, ... ] }
    """
    try:
        identity = get_jwt_identity()
        if not identity:
            return jsonify({"locations": []}), 200

        user_id = int(identity)
        user = AppUser.query.get(user_id)
        if not user:
            return jsonify({"locations": []}), 200

        # All active employments for this user
        active_emps = [e for e in user.employments if e.status == "active"]
        if not active_emps:
            return jsonify({"locations": []}), 200

        # Filter employments where user is owner/manager
        admin_emps = [
            e for e in active_emps
            if (e.position or "").strip().lower() in ("owner", "manager")
        ]
        if not admin_emps:
            return jsonify({"error": "Forbidden"}), 403

        # For now assume single company: take the company of the first admin employment
        company_id = admin_emps[0].comp_id

        # 🔒 Critical: only locations for THAT company
        locations = (
            Location.query
            .filter_by(comp_id=company_id)
            .order_by(Location.loc_name.asc())
            .all()
        )

        result = [
            {"id": loc.loc_id, "name": loc.loc_name}
            for loc in locations
        ]

        return jsonify({"locations": result}), 200

    except Exception:
        from flask import current_app
        current_app.logger.exception("Failed to list locations for admin")
        return jsonify({"error": "Something went wrong"}), 500
