# services/password_reset_service.py
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional

from extensions import db
from models import PasswordResetToken

OTP_TTL_MINUTES_DEFAULT = 30


def _sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _now_utc_naive() -> datetime:
    # Store naive UTC timestamps (consistent with your models)
    return datetime.utcnow()


def _generate_otp() -> str:
    # 6-digit numeric code, zero-padded (000000..999999)
    return f"{secrets.randbelow(1_000_000):06d}"


def create_reset_token(*, user_id: int, ttl_minutes: int = OTP_TTL_MINUTES_DEFAULT) -> str:
    """
    Generates a 6-digit OTP (as the 'token'), stores only its SHA-256 hash
    in PasswordResetToken with a TTL, and returns the raw OTP string.

    NOTE: We invalidate any previous unused tokens for the same user to keep the flow clean.
    """
    # Invalidate prior unused tokens (optional but recommended)
    db.session.query(PasswordResetToken).where(
        PasswordResetToken.user_id == user_id,
        PasswordResetToken.used_at.is_(None),
    ).delete(synchronize_session=False)

    otp = _generate_otp()
    token_hash = _sha256_hex(otp)

    rec = PasswordResetToken(
        user_id=user_id,
        token_hash=token_hash,
        # created_at has default=datetime.utcnow in your model
        expires_at=_now_utc_naive() + timedelta(minutes=ttl_minutes),
        used_at=None,
    )
    db.session.add(rec)
    db.session.commit()
    return otp  # <-- return the raw 6-digit code (send this via email)


def consume_reset_token(raw_token: str) -> Optional[int]:
    """
    Validates the provided 6-digit OTP, marks it as used, and returns the user_id.
    Returns None if invalid, already used, or expired.
    """
    raw = (raw_token or "").strip()
    # Basic shape validation
    if len(raw) != 6 or not raw.isdigit():
        return None

    token_hash = _sha256_hex(raw)
    rec = PasswordResetToken.query.filter_by(token_hash=token_hash).first()
    if not rec:
        return None
    if rec.used_at is not None:
        return None
    if _now_utc_naive() > rec.expires_at:
        return None

    rec.used_at = _now_utc_naive()
    db.session.add(rec)
    db.session.commit()
    return rec.user_id
