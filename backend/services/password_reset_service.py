import secrets, hashlib
from datetime import datetime, timedelta
from typing import Optional
from extensions import db
from models import PasswordResetToken

def _sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def create_reset_token(*, user_id: int, ttl_minutes: int = 30) -> str:
    # Invalidate any prior unused tokens for this user (optional but recommended)
    db.session.query(PasswordResetToken)\
        .where(PasswordResetToken.user_id == user_id, PasswordResetToken.used_at.is_(None))\
        .delete(synchronize_session=False)

    raw = secrets.token_urlsafe(32)  # ~43 chars URL-safe
    token_hash = _sha256_hex(raw)
    prt = PasswordResetToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(minutes=ttl_minutes),
    )
    db.session.add(prt)
    db.session.commit()
    return raw

def consume_reset_token(raw_token: str) -> Optional[int]:
    token_hash = _sha256_hex(raw_token)
    prt = PasswordResetToken.query.filter_by(token_hash=token_hash).first()
    if not prt:
        return None
    if prt.used_at is not None:
        return None
    if datetime.utcnow() > prt.expires_at:
        return None

    prt.used_at = datetime.utcnow()
    db.session.add(prt)
    db.session.commit()
    return prt.user_id
