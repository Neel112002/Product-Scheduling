# controllers/password_flow_controller.py
from flask import request, jsonify, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity

from services.auth_service import AuthService
from services.password_reset_service import create_reset_token, consume_reset_token
from utils.mailer import send_password_reset_otp_email  # <-- use OTP mailer


class PasswordFlowController:
    def __init__(self):
        self.svc = AuthService()

    # 1) Change password (in-app, JWT)
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
                confirm_password=confirm_password,
            )
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        return jsonify({"message": "Password updated successfully. Please log in again on other devices."}), 200

    # 2) Forgot password (request OTP)
    # POST /auth/forgot-password  { "email": "user@example.com" }
    def forgot_password(self):
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        generic = "If that email exists, a reset code has been sent."

        if not email:
            return jsonify({"message": generic}), 200

        # Be privacy-safe: don't reveal if the email exists
        user = getattr(self.svc, "find_user_by_email_ci", None)
        user = user(email) if callable(user) else self.svc.find_user_by_email(email)

        if user:
            otp_code = create_reset_token(user_id=user.user_id, ttl_minutes=30)  # returns 6-digit OTP
            send_password_reset_otp_email(to_email=user.user_email, otp_code=otp_code)

        return jsonify({"message": generic}), 200

    # 2a) Optional: simple HTML page for manual reset with OTP (GET)
    # GET /auth/forgot-password/confirm
    # Useful if a user opens a web page and types the code received by email.
    def forgot_password_confirm_page(self):
        html = """
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Reset Password</title>
          </head>
          <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto; max-width: 520px; margin: 48px auto; padding: 0 16px;">
            <h2>Reset your password</h2>
            <form method="post">
              <div style="margin:12px 0;">
                <label>6-digit code</label><br>
                <input type="text" name="token" minlength="6" maxlength="6" required style="width:100%;padding:8px;">
              </div>
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

    # 3) Forgot password confirm (OTP) – accepts JSON OR form
    # POST /auth/forgot-password/confirm
    # Body JSON or form: { "token": "123456", "new_password": "...", "confirm_password": "..." }
    def forgot_password_confirm(self):
        data = request.get_json(silent=True) or request.form.to_dict() or {}

        raw_otp          = (data.get("token") or "").strip()
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
        if not (raw_otp.isdigit() and len(raw_otp) == 6):
            return (html_response("Reset password", "Invalid code.", 400)
                    if request.form else jsonify({"error": "Invalid code."}), 400)
        if len(new_password) < 8:
            return (html_response("Reset password", "Password must be at least 8 characters.", 400)
                    if request.form else jsonify({"error": "Password must be at least 8 characters."}), 400)
        if new_password != confirm_password:
            return (html_response("Reset password", "Passwords do not match.", 400)
                    if request.form else jsonify({"error": "Passwords do not match."}), 400)

        user_id = consume_reset_token(raw_otp)
        if not user_id:
            # Neutral response (don’t leak whether the code was valid)
            return (html_response("Reset password", "If the code is valid, the password has been updated.")
                    if request.form else jsonify({"message": "If the code is valid, the password has been updated."}), 200)

        try:
            # Keep your existing method name
            self.svc.set_password(
                user_id=user_id,
                new_password=new_password,
                confirm_password=confirm_password,
            )
        except ValueError as e:
            return (html_response("Reset password", str(e), 400)
                    if request.form else jsonify({"error": str(e)}), 400)

        return (html_response("Success", "Your password has been reset. You can close this tab and log in with your new password.")
                if request.form else jsonify({"message": "Password has been reset successfully. Please log in with your new password."}), 200)
