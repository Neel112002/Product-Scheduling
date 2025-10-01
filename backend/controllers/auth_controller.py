# controllers/auth_controller.py
from typing import Any, Dict
from flask import jsonify, request
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity
)
from services.registration_service import RegistrationService
from services.auth_service import AuthService  # your existing simple auth logic

class AuthController:
    
    def __init__(self) -> None:
        self.reg_service = RegistrationService()
        self.auth_service = AuthService()

    # -------- Registration (Wizard) --------
    def register(self):
        payload: Dict[str, Any] = request.get_json() or {}
        try:
            company, location, owner = self.reg_service.register_wizard(payload)
        except ValueError as e:
            # e can be dict or str
            return jsonify({"error": str(e)}), 400

        access = create_access_token(identity=str(owner.user_id))
        refresh = create_refresh_token(identity=str(owner.user_id))
        return jsonify({
            "company": {
                "comp_id": company.comp_id,
                "name": company.comp_name,
                "email": company.comp_email,
                "address": company.comp_address
            },
            "location": {
                "loc_id": location.loc_id,
                "name": location.loc_name,
                "address": location.loc_address
            },
            "owner": self.auth_service.serialize_user(owner),
            "access_token": access,
            "refresh_token": refresh
        }), 201

    # -------- Login --------
    def login(self):
        data = request.get_json() or {}
        if "email" not in data or "password" not in data:
            return jsonify({"error": "email and password are required"}), 400

        user = self.auth_service.authenticate(data["email"].strip(), data["password"])
        if not user:
            return jsonify({"error": "Invalid credentials, Try again with correct details!"}), 401

        access = create_access_token(identity=str(user.user_id))
        refresh = create_refresh_token(identity=str(user.user_id))
        return jsonify({
            "user": self.auth_service.serialize_user(user),
            "access_token": access,
            "refresh_token": refresh
        })

    # -------- Refresh --------
    @jwt_required(refresh=True)
    def refresh(self):
        user_id = get_jwt_identity()
        access = create_access_token(identity=user_id)
        return jsonify({"access_token": access})

    # -------- Me --------
    @jwt_required()
    def me(self):
        user_id = get_jwt_identity()
        return jsonify({"user_id": int(user_id)})
