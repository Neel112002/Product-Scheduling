# controllers/auth_controller.py
from typing import Any, Dict
from urllib.parse import urljoin

from flask import jsonify, request, url_for, make_response
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)

from services.registration_service import RegistrationService
from services.auth_service import AuthService
from services.email_verification_service import (
    create_email_verification_token,
    consume_email_verification_token,
)
from utils.mailer import send_email_verification_email


class AuthController:
    """
    Auth Controller
    - Registration (wizard)
    - Login
    - Logout (refresh-token revocation)
    - Refresh (issue new access token)
    - Me (current identity)
    - Verify email
    """

    def __init__(self) -> None:
        self.reg_service = RegistrationService()
        self.auth_service = AuthService()

    # -------- Registration (Wizard) --------
    def register(self):
        payload: Dict[str, Any] = request.get_json(silent=True) or {}
        try:
            company, location, owner = self.reg_service.register_wizard(payload)
        except ValueError as e:
            # Support dict-style field errors from RegistrationService
            detail = e.args[0] if e.args else str(e)
            if isinstance(detail, dict):
                return jsonify({"errors": detail}), 400
            return jsonify({"error": str(detail)}), 400

        # Issue JWTs
        access = create_access_token(identity=str(owner.user_id), fresh=True)
        refresh = create_refresh_token(identity=str(owner.user_id))

        # Create email verification token + send email
        try:
            raw_token = create_email_verification_token(user_id=owner.user_id, ttl_hours=24)
            verify_path = url_for("auth.verify_email", _external=False) + f"?token={raw_token}"
            verify_url = urljoin(request.host_url, verify_path.lstrip("/"))
            send_email_verification_email(to_email=owner.user_email, verify_url=verify_url)
        except Exception:
            # Do not fail signup if email sending fails
            from flask import current_app
            current_app.logger.exception("Failed to send verification email")

        return jsonify({
            "company": {
                "comp_id": company.comp_id,
                "name": company.comp_name,
                "email": company.comp_email,
                "address": company.comp_address,
            },
            "location": {
                "loc_id": location.loc_id,
                "name": location.loc_name,
                "address": location.loc_address,
            },
            "owner": self.auth_service.serialize_user(owner),
            "access_token": access,
            "refresh_token": refresh,
        }), 201

    # -------- Login --------
    def login(self):
        data = request.get_json(silent=True) or {}

        email = (data.get("email") or "").strip().lower()
        password = (data.get("password") or "").strip()

        if not email or not password:
            return jsonify({"error": "email and password are required"}), 400

        user = self.auth_service.authenticate(email, password)
        if not user:
            return jsonify({"error": "Invalid credentials, Try again with correct details!"}), 401

        # 🔥 Block login if email not verified
        if not user.is_verified:
            return jsonify({
                "error": "Email not verified",
                "code": "EMAIL_NOT_VERIFIED",
                "message": "Please verify your email to continue."
            }), 403

        access = create_access_token(identity=str(user.user_id), fresh=True)
        refresh = create_refresh_token(identity=str(user.user_id))

        return jsonify({
            "user": self.auth_service.serialize_user(user),
            "access_token": access,
            "refresh_token": refresh,
        }), 200

    # -------- Logout (revoke current refresh token) --------
    @jwt_required(refresh=True)
    def logout(self):
        """
        Revokes the *current* refresh token by persisting its JTI in the blocklist table.
        Blocklist enforcement is handled by the jwt token_in_blocklist_loader
        configured in extensions.init_extensions.
        """
        jwt_data = get_jwt()
        user_id = get_jwt_identity()
        jti = jwt_data.get("jti")
        token_type = jwt_data.get("type")  # should be "refresh"
        exp_ts = jwt_data.get("exp")

        # Persist revocation (AuthService handles DB write to TokenBlacklist)
        self.auth_service.revoke_token(
            jti=jti,
            user_id=int(user_id) if user_id is not None else None,
            token_type=token_type or "refresh",
            exp_ts=exp_ts,
        )
        return jsonify({"message": "Logged out successfully"}), 200

    # -------- Update Profile --------
    @jwt_required()
    def update_profile(self):
        """
        PATCH /auth/profile
        Body: { "display_name": "John Doe" }
        """
        from flask_jwt_extended import get_jwt_identity
        from extensions import db

        user_id = int(get_jwt_identity())
        data    = request.get_json(silent=True) or {}

        user = self.auth_service.get_user_by_id(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        display_name = (data.get("display_name") or "").strip()
        if not display_name:
            return jsonify({"error": "Display name cannot be empty"}), 400
        if len(display_name) > 60:
            return jsonify({"error": "Display name must be under 60 characters"}), 400

        user.display_name = display_name
        db.session.commit()

        return jsonify({
            "message": "Profile updated",
            "user":    self.auth_service.serialize_user(user),
        }), 200
    
    # -------- Refresh (issue new access token) --------
    @jwt_required(refresh=True)
    def refresh(self):
        """
        Issues a new access token. By default, we do not rotate the refresh token here.
        If you want rotation, create a new refresh token and return it as well.
        """
        user_id = get_jwt_identity()
        access = create_access_token(identity=str(user_id), fresh=False)
        return jsonify({"access_token": access}), 200

    # -------- Me (current identity) --------
    @jwt_required()
    def me(self):
        """
        Minimal identity endpoint. If you want user details, uncomment the lines
        to fetch/serialize the user from AuthService.
        """
        user_id = get_jwt_identity()

        # Optional: return full user object if your AuthService provides it
        # user = self.auth_service.get_user_by_id(int(user_id))
        # if user:
        #     return jsonify({"user": self.auth_service.serialize_user(user)}), 200

        return jsonify({"user_id": int(user_id)}), 200

    # -------- Verify Email (from email button) --------
    def verify_email(self):
        """
        Handles GET /auth/verify-email?token=...
        Called when the user clicks the 'Verify email' button in their email.
        """
        token = (request.args.get("token") or "").strip()
        if not token:
            return make_response("<h3>Invalid verification link.</h3>", 400)

        user_id = consume_email_verification_token(token)
        if not user_id:
            return make_response("<h3>This verification link is invalid or has expired.</h3>", 400)

        try:
            # Mark user as verified
            self.auth_service.mark_email_verified(int(user_id))
        except ValueError as e:
            return make_response(f"<h3>{str(e)}</h3>", 400)

        html = """
        <!doctype html>
        <html>
          <head><meta charset="utf-8"><title>Email verified</title></head>
          <body style="font-family: system-ui; max-width:520px; margin:48px auto; padding:0 16px;">
            <h2>Email verified 🎉</h2>
            <p>Your email has been successfully verified. You can now return to the app and sign in.</p>
          </body>
        </html>
        """
        return make_response(html, 200)
