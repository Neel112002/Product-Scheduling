# services/auth_service.py
from typing import Optional
from sqlalchemy.exc import IntegrityError
from extensions import db
from models import AppUser
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
        """
        normalized_email = (email or "").strip()
        user: Optional[AppUser] = AppUser.query.filter_by(user_email=normalized_email).first()
        if not user:
            return None
        if not verify_password(password, user.user_password):
            return None
        return user

    # -------- Utilities --------
    @staticmethod
    def serialize_user(user: AppUser) -> dict:
        return {
            "user_id": user.user_id,
            "username": user.username,
            "user_email": user.user_email,
            "display_name": user.display_name,
            "is_verified": user.is_verified,
        }


#--- Changepassword/ForgetPassowrd ---#
    def find_user_by_email_ci(self, email: str) -> Optional[AppUser]:
        """Case-insensitive lookup by email."""
        return AppUser.query.filter(func.lower(AppUser.user_email) == email.lower()).first()

    def change_password(self, *, user_id: int, current_password: str, new_password: str, confirm_password: str) -> None:
        if new_password != confirm_password:
            raise ValueError("Passwords do not match")

        user = AppUser.query.get(user_id)
        if not user:
            raise ValueError("User not found")

        if not verify_password(current_password, user.user_password):
            raise ValueError("Current password is incorrect")

        user.user_password = hash_password(new_password)
        db.session.commit()

    def set_password(self, *, user_id: int, new_password: str, confirm_password: str) -> None:
        """Directly set a new password (used by forgot-password confirm)."""
        if new_password != confirm_password:
            raise ValueError("Passwords do not match")

        user = AppUser.query.get(user_id)
        if not user:
            raise ValueError("User not found")

        user.user_password = hash_password(new_password)
        db.session.commit()
