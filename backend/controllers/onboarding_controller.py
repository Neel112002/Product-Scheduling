# controllers/onboarding_controller.py
from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity
from services.onboarding_service import OnboardingService
from models import Employment, Location


class OnboardingController:
    def __init__(self):
        self.svc = OnboardingService()

    # Manager/Owner endpoint: invite staff
    def create_invite(self):
        data = request.get_json(silent=True) or {}

        email = (data.get("email") or "").strip().lower()
        location_id = data.get("location_id")
        position = (data.get("position") or "Staff").strip()

        # NEW: we *don't* require comp_id anymore – we derive it from caller.
        if not email or not location_id:
            return jsonify({"error": "email and location_id are required"}), 400

        # Who is calling this?
        try:
            caller_id = int(get_jwt_identity())
        except (TypeError, ValueError):
            return jsonify({"error": "Unauthorized"}), 401

        # All active employments for caller
        active_emps = (
            Employment.query
            .filter_by(user_id=caller_id, status="active")
            .all()
        )
        if not active_emps:
            return jsonify({"error": "not authorized to invite"}), 403

        # Only owner / manager / admin can invite
        admin_emps = [
            e for e in active_emps
            if (e.position or "").strip().lower() in ("owner", "manager", "admin")
        ]
        if not admin_emps:
            return jsonify({"error": "not authorized to invite"}), 403

        # Assume single company for now: take company from first admin employment
        admin_emp = admin_emps[0]
        comp_id = admin_emp.comp_id

        # Ensure the chosen location belongs to this company
        location = (
            Location.query
            .filter_by(loc_id=location_id, comp_id=comp_id)
            .first()
        )
        if not location:
            return jsonify({"error": "Invalid location_id for this company"}), 400

        try:
            invite, user = self.svc.create_invite(
                company=location.company,
                location=location,
                email=email,
                position=position,
            )
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception:
            from flask import current_app
            current_app.logger.exception("Error creating onboarding invite")
            return jsonify({"error": "Something went wrong"}), 500

        return jsonify({
            "message": "Onboarding email sent.",
            "result": {
                "user_id": int(user.user_id),
                "invite_id": int(invite.form_id),
                "email": email,
            },
        }), 200

    # Public endpoint: prevalidate invite link (legacy / if you still want it)
    def prevalidate(self):
        token = (request.args.get("token") or "").strip()
        if not token:
            return jsonify({"error": "token required"}), 400
        try:
            info = self.svc.prevalidate(token)
            return jsonify(info)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    # Public endpoint: accept invite and set password (legacy flow)
    def accept(self):
        data = request.get_json() or {}
        token = data.get("token")
        username = data.get("username")
        password = data.get("password")
        confirm = data.get("confirm_password")

        if not token or not username or not password or not confirm:
            return jsonify({"error": "token, username, password, confirm_password are required"}), 400

        try:
            result = self.svc.accept_invite(token, username, password, confirm)
            return jsonify(result), 201
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
