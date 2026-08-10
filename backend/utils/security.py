# utils/security.py
from extensions import bcrypt


def hash_password(plain: str) -> str:
    return bcrypt.generate_password_hash(plain).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    # bcrypt hashes
    if hashed.startswith("$2b$") or hashed.startswith("$2a$"):
        return bcrypt.check_password_hash(hashed, plain)
    # Legacy PBKDF2 fallback for existing users
    from werkzeug.security import check_password_hash
    try:
        return check_password_hash(hashed, plain)
    except Exception:
        return False