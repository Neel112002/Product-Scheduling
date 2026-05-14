# services/auth_service.py
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from extensions import db, bcrypt, redis_client
from models import AppUser, TokenBlacklist
from utils.security import hash_password, verify_password


class AuthService:

    def register_user(self, username, email, password, display_name=None):
        user = AppUser(
            username=username.strip(),
            user_email=email.strip(),
            user_password=hash_password(password),
            is_verified=False,
            display_name=display_name,
        )
        db.session.add(user)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise ValueError("Email already registered")
        return user

    def authenticate(self, email: str, password: str) -> Optional[AppUser]:
        user = AppUser.query.filter_by(user_email=(email or "").strip()).first()
        if not user or not verify_password(password, user.user_password):
            return None
        return user

    def find_user_by_email_ci(self, email: str) -> Optional[AppUser]:
        return AppUser.query.filter(
            func.lower(AppUser.user_email) == email.lower()
        ).first()

    def find_user_by_email(self, email: str) -> Optional[AppUser]:
        return AppUser.query.filter_by(user_email=(email or "").strip()).first()

    def get_user_by_id(self, user_id: int) -> Optional[AppUser]:
        return AppUser.query.get(user_id)

    def revoke_token(self, *, jti, user_id, token_type, exp_ts):
        if not jti:
            return
        ttl = None
        expires_at = None
        if exp_ts is not None:
            now_ts = int(datetime.now(timezone.utc).timestamp())
            ttl = max(exp_ts - now_ts, 1)
            expires_at = datetime.fromtimestamp(exp_ts, tz=timezone.utc).replace(tzinfo=None)
        if redis_client:
            if ttl:
                redis_client.setex(f"blocklist:{jti}", ttl, "1")
            else:
                redis_client.set(f"blocklist:{jti}", "1")
        if not TokenBlacklist.query.filter_by(jti=jti).first():
            tb = TokenBlacklist(
                jti=jti,
                user_id=user_id or 0,
                token_type=token_type or "refresh",
                expires_at=expires_at,
            )
            db.session.add(tb)
            db.session.commit()

    def mark_email_verified(self, user_id: int):
        user = AppUser.query.filter_by(user_id=user_id).first()
        if not user:
            raise ValueError("User not found.")
        if not user.is_verified:
            user.is_verified = True
            db.session.commit()

    def update_push_token(self, user_id: int, push_token: str):
        user = AppUser.query.get(user_id)
        if user:
            user.push_token = push_token
            db.session.commit()

    def change_password(self, *, user_id, current_password, new_password, confirm_password):
        if new_password != confirm_password:
            raise ValueError("Passwords do not match")
        if len(new_password) < 8:
            raise ValueError("Password must be at least 8 characters")
        user = AppUser.query.get(user_id)
        if not user:
            raise ValueError("User not found")
        if not verify_password(current_password, user.user_password):
            raise ValueError("Current password is incorrect")
        if verify_password(new_password, user.user_password):
            raise ValueError("New password must be different from current password")
        user.user_password = hash_password(new_password)
        db.session.commit()

    def set_password(self, *, user_id, new_password, confirm_password):
        if new_password != confirm_password:
            raise ValueError("Passwords do not match")
        if len(new_password) < 8:
            raise ValueError("Password must be at least 8 characters")
        user = AppUser.query.get(user_id)
        if not user:
            raise ValueError("User not found")
        if verify_password(new_password, user.user_password):
            raise ValueError("New password must be different from current password")
        user.user_password = hash_password(new_password)
        db.session.commit()

    @staticmethod
    def serialize_user(user: AppUser) -> dict:
        emp = next((e for e in user.employments if e.status == "active"), None)
        return {
            "user_id":      user.user_id,
            "username":     user.username,
            "user_email":   user.user_email,
            "display_name": user.display_name,
            "is_verified":  user.is_verified,
            "role":         emp.role.name.lower() if emp and emp.role else None,
            "company_id":   emp.comp_id     if emp else None,
            "location_id":  emp.location_id if emp else None,
        }