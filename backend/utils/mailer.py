from flask import current_app
from flask_mail import Message
from extensions import mail

def send_password_reset_email(to_email: str, reset_url: str) -> None:
    if not current_app.config.get("EMAIL_SENDING_ENABLED"):
        current_app.logger.info(f"[DEV] Password reset link for {to_email}: {reset_url}")
        return

    msg = Message(
        subject="Reset your password",
        recipients=[to_email],
        html=f"""
            <p>We received a request to reset your password.</p>
            <p><a href="{reset_url}">Click here to reset your password</a></p>
            <p>This link expires in 30 minutes. If you didn't request this, you can ignore this email.</p>
        """,
    )
    try:
        mail.send(msg)
    except Exception:
        current_app.logger.exception("Email send failed")
