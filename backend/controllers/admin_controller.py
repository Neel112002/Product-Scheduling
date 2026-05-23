# controllers/admin_controller.py
from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from extensions import db
from models import AppUser, Employment, Location


class AdminController:

    # ── GET /admin/locations ──────────────────────────────────────────────────
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
                    {
                        "id":       l.loc_id,
                        "name":     l.loc_name,
                        "address":  l.loc_address,
                        "timezone": l.timezone,
                        "loc_lat":  l.loc_lat,
                        "loc_lng":  l.loc_lng,
                    }
                    for l in locations
                ]
            }), 200
        except Exception:
            from flask import current_app
            current_app.logger.exception("Failed to list locations")
            return jsonify({"error": "Something went wrong"}), 500

    # ── GET /admin/company ────────────────────────────────────────────────────
    def get_company(self):
        user_id = int(get_jwt_identity())
        user    = AppUser.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        emp = next(
            (e for e in user.employments
             if e.status == "active" and e.role
             and e.role.name.lower() in ("owner", "manager")),
            None,
        )
        if not emp:
            return jsonify({"error": "Forbidden"}), 403
        comp = emp.company
        return jsonify({
            "company": {
                "id":      comp.comp_id,
                "name":    comp.comp_name,
                "email":   comp.comp_email,
                "address": comp.comp_address,
                "plan":    comp.plan,
            }
        }), 200

    # ── PUT /admin/company/plan ───────────────────────────────────────────────
    def update_plan(self):
        user_id = int(get_jwt_identity())
        user    = AppUser.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        emp = next(
            (e for e in user.employments
             if e.status == "active" and e.role
             and e.role.name.lower() == "owner"),
            None,
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

    # ── GET /admin/staff ──────────────────────────────────────────────────────
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
             if e.location_id == location_id
             and e.status == "active"
             and e.role
             and e.role.name.lower() in ("owner", "manager", "supervisor")),
            None,
        )
        if not caller_emp:
            return jsonify({"error": "Forbidden"}), 403
        emps = Employment.query.filter_by(location_id=location_id, status="active").all()
        return jsonify({
            "staff": [
                {
                    "user_id":           emp.user.user_id,
                    "username":          emp.user.username,
                    "display_name":      emp.user.display_name,
                    "email":             emp.user.user_email,
                    "role":              emp.role.name if emp.role else None,
                    "emp_id":            emp.emp_id,
                    "employment_type":   emp.employment_type   if hasattr(emp, "employment_type") else "full_time",
                    "hourly_rate":       float(emp.hourly_rate) if (hasattr(emp, "hourly_rate") and emp.hourly_rate) else None,
                    "start_date":        emp.start_date.isoformat() if emp.start_date else None,
                }
                for emp in emps if emp.user
            ]
        }), 200

    # ── GET /admin/staff/<user_id>/profile ────────────────────────────────────
    def get_employee_profile(self, user_id: int):
        manager_id = int(get_jwt_identity())
        mgr_emp    = Employment.query.filter_by(
            user_id=manager_id, status="active"
        ).first()
        if not mgr_emp or mgr_emp.role.name.lower() not in ("owner", "manager"):
            return jsonify({"error": "Forbidden"}), 403

        emp = Employment.query.filter_by(
            user_id=user_id,
            comp_id=mgr_emp.comp_id,
        ).first()
        if not emp:
            return jsonify({"error": "Employee not found"}), 404

        return jsonify({"profile": self._serialize_employee(emp)}), 200

    # ── PUT /admin/staff/<user_id>/profile ────────────────────────────────────
    def update_employee_profile(self, user_id: int):
        manager_id = int(get_jwt_identity())
        mgr_emp    = Employment.query.filter_by(
            user_id=manager_id, status="active"
        ).first()
        if not mgr_emp or mgr_emp.role.name.lower() not in ("owner", "manager"):
            return jsonify({"error": "Forbidden"}), 403

        emp = Employment.query.filter_by(
            user_id=user_id,
            comp_id=mgr_emp.comp_id,
        ).first()
        if not emp:
            return jsonify({"error": "Employee not found"}), 404

        data = request.get_json(silent=True) or {}

        if "hourly_rate" in data:
            try:
                rate = float(data["hourly_rate"]) if data["hourly_rate"] is not None else None
                emp.hourly_rate = rate
            except (ValueError, TypeError):
                return jsonify({"error": "Invalid hourly rate"}), 400

        if "employment_type" in data:
            if data["employment_type"] not in ("full_time", "part_time", "casual"):
                return jsonify({"error": "Invalid employment type"}), 400
            emp.employment_type = data["employment_type"]

        if "max_hours_week" in data:
            try:
                emp.max_hours_week = int(data["max_hours_week"]) if data["max_hours_week"] else None
            except (ValueError, TypeError):
                return jsonify({"error": "Invalid max hours"}), 400

        if "overtime_eligible" in data:
            emp.overtime_eligible = bool(data["overtime_eligible"])

        if "phone" in data:
            emp.phone = (data["phone"] or "").strip() or None

        if "emergency_contact" in data:
            emp.emergency_contact = (data["emergency_contact"] or "").strip() or None

        if "emergency_phone" in data:
            emp.emergency_phone = (data["emergency_phone"] or "").strip() or None

        if "notes" in data:
            emp.notes = (data["notes"] or "").strip() or None

        if "status" in data and data["status"] in ("active", "inactive"):
            emp.status = data["status"]

        db.session.commit()

        return jsonify({
            "message": "Profile updated",
            "profile": self._serialize_employee(emp),
        }), 200

    # ── PUT /admin/locations/<loc_id> ─────────────────────────────────────────
    def update_location(self, loc_id: int):
        try:
            user_id = int(get_jwt_identity())
            emp = Employment.query.filter_by(user_id=user_id, status="active").first()
            if not emp:
                return jsonify({"error": "Not found"}), 404

            location = Location.query.filter_by(
                loc_id=loc_id, comp_id=emp.comp_id
            ).first()
            if not location:
                return jsonify({"error": "Location not found"}), 404

            data = request.get_json(silent=True) or {}

            if "loc_name" in data and data["loc_name"]:
                location.loc_name = data["loc_name"]
            if "loc_address" in data:
                location.loc_address = data["loc_address"]
            if "loc_lat" in data:
                location.loc_lat = (
                    float(data["loc_lat"]) if data["loc_lat"] is not None else None
                )
            if "loc_lng" in data:
                location.loc_lng = (
                    float(data["loc_lng"]) if data["loc_lng"] is not None else None
                )

            db.session.commit()

            return jsonify({
                "message": "Location updated",
                "location": {
                    "id":      location.loc_id,
                    "name":    location.loc_name,
                    "address": location.loc_address,
                    "loc_lat": location.loc_lat,
                    "loc_lng": location.loc_lng,
                },
            }), 200

        except Exception:
            from flask import current_app
            current_app.logger.exception("Failed to update location")
            return jsonify({"error": "Something went wrong"}), 500

    # ── Serializer ────────────────────────────────────────────────────────────
    @staticmethod
    def _serialize_employee(emp) -> dict:
        user = emp.user
        return {
            "user_id":           user.user_id,
            "username":          user.username,
            "display_name":      user.display_name,
            "user_email":        user.user_email,
            "emp_id":            emp.emp_id,
            "role":              emp.role.name if emp.role else None,
            "role_id":           emp.role_id,
            "status":            emp.status,
            "employment_type":   getattr(emp, "employment_type",   "full_time"),
            "hourly_rate":       float(emp.hourly_rate) if getattr(emp, "hourly_rate", None) else None,
            "max_hours_week":    getattr(emp, "max_hours_week",    None),
            "overtime_eligible": getattr(emp, "overtime_eligible", True),
            "phone":             getattr(emp, "phone",             None),
            "emergency_contact": getattr(emp, "emergency_contact", None),
            "emergency_phone":   getattr(emp, "emergency_phone",   None),
            "notes":             getattr(emp, "notes",             None),
            "hire_date":         emp.start_date.isoformat() if emp.start_date else None,
            "location_id":       emp.location_id,
        }