# controllers/onboarding_controller.py
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.onboarding_service import OnboardingService
from models import Employment

class OnboardingController:
    def __init__(self):
        self.svc = OnboardingService()

    # Manager/Owner endpoint
    @jwt_required()
    def create_invite(self):
        data = request.get_json() or {}
        comp_id = data.get("comp_id")
        email = data.get("email")
        location_id = data.get("location_id")
        position = data.get("position", "Employee")
        ttl_days = int(data.get("ttl_days", 7))

        if not comp_id or not email:
            return jsonify({"error": "comp_id and email are required"}), 400

        # Simple RBAC: ensure caller is employed in this company and not just any employee.
        caller_id = int(get_jwt_identity())
        caller_emp = Employment.query.filter_by(user_id=caller_id, comp_id=comp_id, status="active").first()
        if not caller_emp or caller_emp.position.lower() not in ("owner", "manager", "admin"):
            return jsonify({"error": "not authorized to invite"}), 403

        try:
            invite, token = self.svc.create_invite(comp_id=comp_id, email=email, location_id=location_id, position=position, ttl_days=ttl_days)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        # You’ll email this token as a link; returning here for testing
        return jsonify({
            "form_id": int(invite.form_id),
            "status": invite.status,
            "invite_token": token
        }), 201

    # Public endpoint: prevalidate invite link
    def prevalidate(self):
        token = (request.args.get("token") or "").strip()
        if not token:
            return jsonify({"error": "token required"}), 400
        try:
            info = self.svc.prevalidate(token)
            return jsonify(info)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    # Public endpoint: accept invite and set password
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
