# controllers/password_flow_controller.py
from flask import request, jsonify, url_for, make_response
from urllib.parse import urljoin
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.auth_service import AuthService
from services.password_reset_service import create_reset_token, consume_reset_token
from utils.mailer import send_password_reset_email

class PasswordFlowController:
    def __init__(self):
        self.svc = AuthService()

    # 1) Change password (in-app)
    @jwt_required()
    def change_password(self):
        data = request.get_json(silent=True) or {}
        current_password = (data.get("current_password") or "").strip()
        new_password     = (data.get("new_password") or "").strip()
        confirm_password = (data.get("confirm_password") or "").strip()

        if len(new_password) < 8:
            return jsonify({"error": "Password must be at least 8 characters."}), 400
        if new_password != confirm_password:
            return jsonify({"error": "Passwords do not match."}), 400
        if current_password and current_password == new_password:
            return jsonify({"error": "New password must be different from current password."}), 400

        user_id = int(get_jwt_identity())
        try:
            self.svc.change_password(
                user_id=user_id,
                current_password=current_password,
                new_password=new_password,
                confirm_password=confirm_password
            )
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        return jsonify({"message": "Password updated successfully. Please log in again on other devices."}), 200

    # 2) Forgot password (request link)
    def forgot_password(self):
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip()
        generic = "If that email exists, a reset link has been sent."

        if not email:
            return jsonify({"message": generic}), 200

        user = self.svc.find_user_by_email_ci(email)
        if not user:
            return jsonify({"message": generic}), 200

        raw_token = create_reset_token(user_id=user.user_id, ttl_minutes=30)

        # Link opens a small HTML page (GET) that posts back to the same endpoint (POST)
        confirm_path = url_for("auth.forgot_password_confirm", _external=False) + f"?token={raw_token}"
        reset_link = urljoin(request.host_url, confirm_path.lstrip("/"))

        send_password_reset_email(user.user_email, reset_link)
        return jsonify({"message": generic}), 200

    # 2a) (NEW) Forgot password confirm PAGE (GET) – renders a tiny form
    def forgot_password_confirm_page(self):
        token = (request.args.get("token") or "").strip()
        html = f"""
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Reset Password</title>
          </head>
          <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto; max-width: 520px; margin: 48px auto; padding: 0 16px;">
            <h2>Reset your password</h2>
            <form method="post" action="{url_for('auth.forgot_password_confirm')}">
              <input type="hidden" name="token" value="{token}">
              <div style="margin:12px 0;">
                <label>New password</label><br>
                <input type="password" name="new_password" minlength="8" required style="width:100%;padding:8px;">
              </div>
              <div style="margin:12px 0;">
                <label>Confirm new password</label><br>
                <input type="password" name="confirm_password" minlength="8" required style="width:100%;padding:8px;">
              </div>
              <button type="submit" style="padding:10px 16px;cursor:pointer;">Update password</button>
            </form>
          </body>
        </html>
        """
        return make_response(html, 200)

    # 3) Forgot password (confirm via token) – accepts JSON OR form
    def forgot_password_confirm(self):
        # Accept JSON or form submission
        data = request.get_json(silent=True)
        if not data:
            data = request.form.to_dict()

        token            = (data.get("token") or request.args.get("token") or "").strip()
        new_password     = (data.get("new_password") or "").strip()
        confirm_password = (data.get("confirm_password") or "").strip()

        def html_response(title: str, body: str, status: int = 200):
            html = f"""<!doctype html>
            <html><head><meta charset="utf-8"><title>{title}</title></head>
            <body style="font-family: system-ui; max-width:520px; margin:48px auto; padding:0 16px;">
              <h3>{title}</h3><p>{body}</p>
            </body></html>"""
            return make_response(html, status)

        # Basic validations
        if not token:
            # If came from form, render HTML; else JSON
            if request.form:
                return html_response("Reset password", "Missing token.", 400)
            return jsonify({"error": "Missing token."}), 400
        if len(new_password) < 8:
            if request.form:
                return html_response("Reset password", "Password must be at least 8 characters.", 400)
            return jsonify({"error": "Password must be at least 8 characters."}), 400
        if new_password != confirm_password:
            if request.form:
                return html_response("Reset password", "Passwords do not match.", 400)
            return jsonify({"error": "Passwords do not match."}), 400

        user_id = consume_reset_token(token)
        if not user_id:
            # Don’t leak token validity; provide neutral message
            if request.form:
                return html_response("Reset password", "If the token is valid, the password has been updated.")
            return jsonify({"message": "If the token is valid, the password has been updated."}), 200

        try:
            self.svc.set_password(
                user_id=user_id,
                new_password=new_password,
                confirm_password=confirm_password
            )
        except ValueError as e:
            if request.form:
                return html_response("Reset password", str(e), 400)
            return jsonify({"error": str(e)}), 400

        if request.form:
            return html_response("Success", "Your password has been reset. You can close this tab and log in with your new password.")
        return jsonify({"message": "Password has been reset successfully. Please log in with your new password."}), 200
