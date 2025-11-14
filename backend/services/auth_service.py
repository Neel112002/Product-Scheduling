# services/auth_service.py
from typing import Optional
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy import func

from extensions import db
from models import AppUser, TokenBlacklist
from utils.security import hash_password, verify_password


class AuthService:
    """
    Authentication & user management logic.

    Public self-registration is disabled in your app; use `register_user` ONLY
    from controlled flows (e.g., onboarding acceptance).
    """

    # -------- User creation (internal use only) --------
    def register_user(
        self,
        username: str,
        email: str,
        password: str,
        display_name: Optional[str] = None,
    ) -> AppUser:
        """
        Create a new user record with a hashed password.
        Intended to be called by onboarding flows (not public routes).
        """
        normalized_email = email.strip()  # CITEXT handles case-insensitive uniqueness

        user = AppUser(
            username=username.strip(),
            user_email=normalized_email,
            user_password=hash_password(password),
            is_verified=False,
            display_name=display_name,
        )

        db.session.add(user)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            # Likely unique email violation on CITEXT column
            raise ValueError("Email already registered")
        return user

    # -------- Authentication --------
    def authenticate(self, email: str, password: str) -> Optional[AppUser]:
        """
        Verify credentials. Returns the user on success, None otherwise.
        (Does NOT check is_verified; controller decides what to do with unverified users.)
        """
        normalized_email = (email or "").strip()
        user: Optional[AppUser] = AppUser.query.filter_by(user_email=normalized_email).first()
        if not user:
            return None
        if not verify_password(password, user.user_password):
            return None
        return user

    # -------- Lookups --------
    def find_user_by_email_ci(self, email: str) -> Optional[AppUser]:
        """Case-insensitive lookup by email (CITEXT-safe)."""
        return AppUser.query.filter(func.lower(AppUser.user_email) == email.lower()).first()

    def find_user_by_email(self, email: str) -> Optional[AppUser]:
        """Simple lookup by email (relies on CITEXT col for case-insensitivity)."""
        normalized_email = (email or "").strip()
        return AppUser.query.filter_by(user_email=normalized_email).first()

    def get_user_by_id(self, user_id: int) -> Optional[AppUser]:
        """Helper used by /auth/me or other flows if needed."""
        return AppUser.query.get(user_id)

    # -------- Token revocation (logout / security) --------
    def revoke_token(self, *, jti: str, user_id: Optional[int], token_type: str, exp_ts: Optional[int]) -> None:
        """
        Persist a token into the blacklist so it is treated as revoked.

        Called from AuthController.logout() for the *current* refresh token.
        """
        if not jti:
            return

        # Avoid inserting duplicates
        existing = TokenBlacklist.query.filter_by(jti=jti).first()
        if existing:
            return

        # Convert exp_ts (UNIX epoch) → naive UTC datetime if provided
        expires_at = None
        if exp_ts is not None:
            expires_at = datetime.fromtimestamp(exp_ts, tz=timezone.utc).replace(tzinfo=None)

        tb = TokenBlacklist(
            jti=jti,
            user_id=user_id or 0,
            token_type=token_type or "refresh",
            expires_at=expires_at,
        )
        db.session.add(tb)
        db.session.commit()

    # -------- Email verification --------
    def mark_email_verified(self, user_id: int) -> None:
        """
        Mark a user's email as verified.
        Used by /auth/verify-email after a successful verification token.
        """
        user = AppUser.query.filter_by(user_id=user_id).first()
        if not user:
            raise ValueError("User not found.")

        if not user.is_verified:
            user.is_verified = True
            db.session.add(user)
            db.session.commit()

    # -------- Utilities --------
    @staticmethod
    def serialize_user(user: AppUser) -> dict:
        emp = None
        if user.employments:
            emp = next((e for e in user.employments if e.status == "active"), None)

        return {
            "user_id": user.user_id,
            "username": user.username,
            "user_email": user.user_email,
            "display_name": user.display_name,
            "is_verified": user.is_verified,
            "role": (emp.position.lower() if emp else None),
            "company_id": (emp.comp_id if emp else None),
            "location_id": (emp.location_id if emp else None),
        }

    # --- Change password / Forgot password --- #
    def change_password(
        self,
        *,
        user_id: int,
        current_password: str,
        new_password: str,
        confirm_password: str,
    ) -> None:
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

    def set_password(
        self,
        *,
        user_id: int,
        new_password: str,
        confirm_password: str,
    ) -> None:
        """
        Used by forgot-password confirm (OTP-based).
        """
        if new_password != confirm_password:
            raise ValueError("Passwords do not match")
        if len(new_password) < 8:
            raise ValueError("Password must be at least 8 characters")

        user = AppUser.query.get(user_id)
        if not user:
            raise ValueError("User not found")

        # Optional: prevent setting same as current
        if verify_password(new_password, user.user_password):
            raise ValueError("New password must be different from current password")

        user.user_password = hash_password(new_password)
        db.session.commit()
