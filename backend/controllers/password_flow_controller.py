# controllers/password_flow_controller.py
from datetime import timedelta
from flask import request, jsonify, current_app
from flask_jwt_extended import create_access_token, decode_token, jwt_required, get_jwt_identity
from services.auth_service import AuthService

class PasswordFlowController:
    def __init__(self) -> None:
        self.svc = AuthService()

    def forgot_password(self):
        """
        Body: { "email": "user@example.com" }
        Always returns 200 (don’t leak whether the email exists).
        DEV ONLY: returns `reset_token` so you can test without email.
        """
        data = request.get_json() or {}
        email = (data.get("email") or "").strip()
        if not email:
            return jsonify({"error": "email is required"}), 400

        # if user exists, generate a short-lived reset token
        user = self.svc.find_user_by_email_ci(email)
        reset_token = None
        if user:
            # stateless, short-lived token with a special scope
            reset_token = create_access_token(
                identity=str(user.user_id),
                additional_claims={"scope": "pwd_reset"},
                expires_delta=timedelta(minutes=15)
            )
            # TODO: send email with link like:
            # https://your-frontend/reset-password?token=<reset_token>

        # In dev, include token in response so you can test quickly.
        resp = {"message": "If that email exists, a reset link has been sent."}
        if current_app.config.get("FLASK_ENV") != "production" and reset_token:
            resp["dev_reset_token"] = reset_token

        return jsonify(resp), 200

    def forgot_password_confirm(self):
        """
        Body:
        {
          "token": "<reset_token_from_email>",
          "new_password": "NewPass123!",
          "confirm_password": "NewPass123!"
        }
        """
        data = request.get_json() or {}
        token = (data.get("token") or "").strip()
        new_password = (data.get("new_password") or "").strip()
        confirm_password = (data.get("confirm_password") or "").strip()

        if not token or not new_password or not confirm_password:
            return jsonify({"error": "token, new_password, confirm_password are required"}), 400

        try:
            decoded = decode_token(token)  # verifies signature & expiry
            if decoded.get("scope") != "pwd_reset":
                return jsonify({"error": "invalid token scope"}), 400

            user_id = int(decoded["sub"])
            self.svc.set_password(user_id=user_id, new_password=new_password, confirm_password=confirm_password)
            return jsonify({"message": "Password has been reset successfully."}), 200

        except Exception as e:
            # Could be expired or invalid token
            return jsonify({"error": "Invalid or expired token"}), 400

    @jwt_required()
    def change_password(self):
        """
        Authenticated change:
        Body:
        {
          "current_password": "OldPass!",
          "new_password": "NewPass123!",
          "confirm_password": "NewPass123!"
        }
        """
        data = request.get_json() or {}
        current_password = (data.get("current_password") or "").strip()
        new_password = (data.get("new_password") or "").strip()
        confirm_password = (data.get("confirm_password") or "").strip()

        if not current_password or not new_password or not confirm_password:
            return jsonify({"error": "current_password, new_password, confirm_password are required"}), 400

        user_id = int(get_jwt_identity())
        try:
            self.svc.change_password(
                user_id=user_id,
                current_password=current_password,
                new_password=new_password,
                confirm_password=confirm_password
            )
            return jsonify({"message": "Password changed successfully."}), 200
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": "Unable to change password"}), 500
