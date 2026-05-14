# controllers/admin_controller.py
from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity
from extensions import db
from models import AppUser, Employment, Location


class AdminController:

    def list_locations(self):
        try:
            user_id = int(get_jwt_identity())
            user    = AppUser.query.get(user_id)
            if not user:
                return jsonify({"locations": []}), 200
            admin_emps = [
                e for e in user.employments
                if e.status == "active" and e.role
                and e.role.name.lower() in ("owner", "manager", "supervisor")
            ]
            if not admin_emps:
                return jsonify({"error": "Forbidden"}), 403
            locations = (
                Location.query
                .filter_by(comp_id=admin_emps[0].comp_id)
                .order_by(Location.loc_name.asc()).all()
            )
            return jsonify({
                "locations": [
                    {"id": l.loc_id, "name": l.loc_name,
                     "address": l.loc_address, "timezone": l.timezone}
                    for l in locations
                ]
            }), 200
        except Exception:
            from flask import current_app
            current_app.logger.exception("Failed to list locations")
            return jsonify({"error": "Something went wrong"}), 500

    def get_company(self):
        user_id = int(get_jwt_identity())
        user    = AppUser.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        emp = next(
            (e for e in user.employments if e.status == "active" and e.role
             and e.role.name.lower() in ("owner", "manager")), None
        )
        if not emp:
            return jsonify({"error": "Forbidden"}), 403
        comp = emp.company
        return jsonify({"company": {
            "id": comp.comp_id, "name": comp.comp_name,
            "email": comp.comp_email, "address": comp.comp_address, "plan": comp.plan,
        }}), 200

    def update_plan(self):
        user_id = int(get_jwt_identity())
        user    = AppUser.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        emp = next(
            (e for e in user.employments if e.status == "active" and e.role
             and e.role.name.lower() == "owner"), None
        )
        if not emp:
            return jsonify({"error": "Only owners can change the plan"}), 403
        data     = request.get_json(silent=True) or {}
        new_plan = (data.get("plan") or "").lower()
        if new_plan not in ("free", "advanced", "professional"):
            return jsonify({"error": "plan must be free, advanced, or professional"}), 400
        emp.company.plan = new_plan
        db.session.commit()
        return jsonify({"message": f"Plan updated to {new_plan}", "plan": new_plan}), 200

    def list_staff(self):
        user_id     = int(get_jwt_identity())
        location_id = request.args.get("location_id", type=int)
        if not location_id:
            return jsonify({"error": "location_id is required"}), 400
        user = AppUser.query.get(user_id)
        if not user:
            return jsonify({"error": "Forbidden"}), 403
        caller_emp = next(
            (e for e in user.employments
             if e.location_id == location_id and e.status == "active"
             and e.role and e.role.name.lower() in ("owner", "manager", "supervisor")), None
        )
        if not caller_emp:
            return jsonify({"error": "Forbidden"}), 403
        emps = Employment.query.filter_by(location_id=location_id, status="active").all()
        return jsonify({
            "staff": [
                {
                    "user_id":      emp.user.user_id,
                    "username":     emp.user.username,
                    "display_name": emp.user.display_name,
                    "email":        emp.user.user_email,
                    "role":         emp.role.name if emp.role else None,
                    "emp_id":       emp.emp_id,
                    "start_date":   emp.start_date.isoformat() if emp.start_date else None,
                }
                for emp in emps if emp.user
            ]
        }), 200