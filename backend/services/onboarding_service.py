# services/onboarding_service.py
from typing import Tuple
import secrets

from extensions import db
from models import OnboardingInvite, Company, Location, AppUser, Employment
from utils.security import hash_password
from utils.mailer import send_onboarding_email


class OnboardingService:
    """
    Company-driven onboarding.

    New flow (no more invite JWT links):
    - Manager/Owner calls create_invite(...) with:
        company, location, email, position
    - We:
        * create or reuse AppUser
        * generate a temporary password and set user_password
        * mark user as verified
        * create/update Employment for that company + location
        * create an OnboardingInvite row
        * send onboarding email with temp password
    - Returns (invite, user)
    """

    def create_invite(
        self,
        *,
        company: Company,
        location: Location,
        email: str,
        position: str,
    ) -> Tuple[OnboardingInvite, AppUser]:
        """
        Creates or reuses user + employment + invite, and sends onboarding email.

        Args:
            company: Company instance (must be the parent of location)
            location: Location instance (already validated to belong to company)
            email: staff email
            position: e.g. "Barista", "Staff", etc.

        Returns:
            (invite, user)
        """
        normalized_email = (email or "").strip().lower()
        if not normalized_email:
            raise ValueError("Email is required")

        # 1) Generate a temporary password and hash it
        temp_password = secrets.token_urlsafe(8)  # ~11 chars
        password_hash = hash_password(temp_password)

        # 2) Create or reuse AppUser
        user = AppUser.query.filter_by(user_email=normalized_email).first()
        if user:
            # Reuse user; reset password to the new temp one and mark verified
            user.user_password = password_hash
            if not user.is_verified:
                user.is_verified = True
        else:
            user = AppUser(
                username=normalized_email,
                user_email=normalized_email,
                user_password=password_hash,
                is_verified=True,
                display_name=None,
            )
            db.session.add(user)
            db.session.flush()  # to get user.user_id

        # 3) Create or update Employment
        employment = (
            Employment.query
            .filter_by(
                user_id=user.user_id,
                comp_id=company.comp_id,
                location_id=location.loc_id,
            )
            .first()
        )
        if employment:
            employment.position = position or employment.position
            employment.status = "active"
        else:
            employment = Employment(
                user_id=user.user_id,
                comp_id=company.comp_id,
                location_id=location.loc_id,
                position=position or "Staff",
                status="active",
            )
            db.session.add(employment)

        # 4) Create OnboardingInvite row (for audit/history)
        invite = OnboardingInvite(
            comp_id=company.comp_id,
            location_id=location.loc_id,
            email=normalized_email,
            status="sent",
        )
        db.session.add(invite)

        # 5) Commit everything
        db.session.commit()

        # 6) Send onboarding email (best-effort, don't break the API if it fails)
        try:
            send_onboarding_email(
                to_email=normalized_email,
                temp_password=temp_password,
                company_name=company.comp_name,
                location_name=location.loc_name,
            )
        except Exception:
            from flask import current_app
            current_app.logger.exception("Failed to send onboarding email")

        return invite, user

    # ---- Legacy methods (token-based invite flow) ----
    # Keep them as stubs so your existing controller methods can call them
    # without breaking the app, but they just report that this flow isn't used.

    def accept_invite(self, token: str, username: str, password: str, confirm_password: str):
        """
        Legacy: token-based invite acceptance is not used in the new onboarding flow.
        """
        raise ValueError("Token-based invite flow is no longer used in this onboarding implementation.")

    def prevalidate(self, token: str):
        """
        Legacy: token-based invite prevalidation is not used in the new onboarding flow.
        """
        raise ValueError("Token-based invite flow is no longer used in this onboarding implementation.")
