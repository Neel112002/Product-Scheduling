from flask import current_app
from flask_mail import Message
from extensions import mail

def send_password_reset_otp_email(to_email: str, otp_code: str) -> None:
    """
    Sends a 6-digit OTP to the user's email. No link.
    """
    if not current_app.config.get("EMAIL_SENDING_ENABLED"):
        current_app.logger.info(f"[DEV] Password reset OTP for {to_email}: {otp_code}")
        return

    msg = Message(
        subject="Your password reset code",
        recipients=[to_email],
        html=f"""
            <p>We received a request to reset your password.</p>
            <p><b>Your code: {otp_code}</b></p>
            <p>This code expires in 30 minutes. If you didn’t request this, you can ignore this email.</p>
        """,
    )
    try:
        mail.send(msg)
    except Exception:
        current_app.logger.exception("Email send failed")


def send_email_verification_email(to_email: str, verify_url: str) -> None:
    """
    Sends an email with a 'Verify email' button.
    """
    if not current_app.config.get("EMAIL_SENDING_ENABLED"):
        current_app.logger.info(f"[DEV] Email verification link for {to_email}: {verify_url}")
        return

    msg = Message(
        subject="Verify your email",
        recipients=[to_email],
        html=f"""
            <p>Welcome to Work Scheduler!</p>
            <p>Please confirm your email address by clicking the button below:</p>
            <p style="margin: 24px 0;">
              <a href="{verify_url}"
                 style="display:inline-block;padding:10px 18px;
                        background-color:#7B4AE2;color:#ffffff;
                        text-decoration:none;border-radius:4px;">
                Verify email
              </a>
            </p>
            <p>This link expires in 24 hours. If you did not sign up, you can safely ignore this email.</p>
        """,
    )
    try:
        mail.send(msg)
    except Exception:
        current_app.logger.exception("Email verification send failed")