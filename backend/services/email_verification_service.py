# services/email_verification_service.py
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional

from extensions import db
from models import EmailVerificationToken


def _sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def create_email_verification_token(user_id: int, ttl_hours: int = 24) -> str:
    """
    Create a long-lived email verification token for given user_id.
    Stores only SHA-256 hash, returns raw token string.
    Invalidates any previous unused tokens for this user.
    """
    # Remove existing unused tokens for the user
    db.session.query(EmailVerificationToken).where(
        EmailVerificationToken.user_id == user_id,
        EmailVerificationToken.used_at.is_(None),
    ).delete(synchronize_session=False)

    raw = secrets.token_urlsafe(32)  # ~43 chars
    token_hash = _sha256_hex(raw)
    rec = EmailVerificationToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(hours=ttl_hours),
        used_at=None,
    )
    db.session.add(rec)
    db.session.commit()
    return raw


def consume_email_verification_token(raw_token: str) -> Optional[int]:
    """
    Validate a verification token and mark it as used.
    Returns user_id if valid, else None.
    """
    token_hash = _sha256_hex(raw_token or "")
    rec = EmailVerificationToken.query.filter_by(token_hash=token_hash).first()
    if not rec:
        return None
    if rec.used_at is not None:
        return None
    if datetime.utcnow() > rec.expires_at:
        return None

    rec.used_at = datetime.utcnow()
    db.session.add(rec)
    db.session.commit()
    return rec.user_id
