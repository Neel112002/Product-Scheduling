# services/onboarding_service.py
from datetime import timedelta
from typing import Optional, Dict, Tuple

from sqlalchemy.exc import IntegrityError
from flask_jwt_extended import create_access_token, decode_token
from extensions import db
from models import OnboardingInvite, Company, Location, AppUser, Employment
from services.auth_service import AuthService

class OnboardingService:
    """
    Company-driven onboarding.
    - create_invite: manager creates an invite for an email at company/location.
    - generate_invite_token: short-lived JWT to embed in link.
    - accept_invite: employee sets username/password and is created/linked.
    """

    def __init__(self) -> None:
        self.auth = AuthService()

    # ---------- Manager/Owner side ----------
    def create_invite(self, comp_id: int, email: str,
                      location_id: Optional[int] = None,
                      position: str = "Employee",
                      ttl_days: int = 7) -> Tuple[OnboardingInvite, str]:
        # ensure company exists
        comp = Company.query.get(comp_id)
        if not comp:
            raise ValueError("Company not found")

        loc = None
        if location_id:
            loc = Location.query.get(location_id)
            if not loc or loc.comp_id != comp_id:
                raise ValueError("Invalid location for company")

        invite = OnboardingInvite(
            comp_id=comp_id,
            location_id=location_id,
            email=email.strip(),
            status="pending"
        )
        db.session.add(invite)
        db.session.commit()  # get form_id

        token = self.generate_invite_token(invite, position=position, ttl_days=ttl_days)
        return invite, token

    def generate_invite_token(self, invite: OnboardingInvite, position: str, ttl_days: int = 7) -> str:
        # A short-lived access token carrying invite claims
        additional_claims = {
            "purpose": "onboarding",
            "form_id": int(invite.form_id),
            "comp_id": int(invite.comp_id),
            "location_id": int(invite.location_id) if invite.location_id else None,
            "email": invite.email,
            "position": position,
        }
        token = create_access_token(
            identity=f"invite:{invite.form_id}",
            additional_claims=additional_claims,
            expires_delta=timedelta(days=ttl_days),
        )
        return token

    # ---------- Employee side ----------
    def accept_invite(self, token: str, username: str, password: str, confirm_password: str) -> Dict:
        # Validate token and claims
        try:
            data = decode_token(token)
        except Exception:
            raise ValueError("Invalid or expired invite token")

        claims = data.get("sub"), data.get("claims") or {}
        if not claims[1] or claims[1].get("purpose") != "onboarding":
            raise ValueError("Invalid invite token")

        form_id = int(claims[1]["form_id"])
        comp_id = int(claims[1]["comp_id"])
        location_id = claims[1]["location_id"]
        email = claims[1]["email"]
        position = claims[1].get("position") or "Employee"

        invite = OnboardingInvite.query.get(form_id)
        if not invite or invite.status not in ("pending", "sent"):
            raise ValueError("Invite is not active")

        if password != confirm_password:
            raise ValueError("password and confirm_password do not match")

        # If user already exists, attach employment; else create user then attach
        user = AppUser.query.filter_by(user_email=email).first()
        if not user:
            # Reuse AuthService for hashing/uniqueness
            user = self.auth.register_user(username=username.strip(), email=email.strip(), password=password)
        else:
            # If user exists, just ensure password is set/updated if desired
            # (Optional) You may choose to reject and ask them to login instead.
            pass

        # Link employment (idempotent-ish)
        try:
            emp = Employment(
                user_id=user.user_id,
                comp_id=comp_id,
                location_id=location_id,
                position=position,
                status="active",
            )
            db.session.add(emp)
            # mark invite accepted
            invite.status = "accepted"
            db.session.add(invite)
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            # Already employed there? Just mark invite accepted.
            invite.status = "accepted"
            db.session.add(invite)
            db.session.commit()

        return {
            "user_id": int(user.user_id),
            "comp_id": comp_id,
            "location_id": int(location_id) if location_id else None,
            "position": position,
            "invite_status": invite.status,
        }

    def prevalidate(self, token: str) -> Dict:
        """Optional: lets frontend confirm the token is valid and fetch context (company/location/email)."""
        try:
            data = decode_token(token)
        except Exception:
            raise ValueError("Invalid or expired invite token")

        claims = data.get("claims") or {}
        if claims.get("purpose") != "onboarding":
            raise ValueError("Invalid invite token")

        comp = Company.query.get(claims["comp_id"])
        loc = Location.query.get(claims["location_id"]) if claims.get("location_id") else None

        return {
            "email": claims.get("email"),
            "position": claims.get("position"),
            "company": {"id": comp.comp_id, "name": comp.comp_name} if comp else None,
            "location": {"id": loc.loc_id, "name": loc.loc_name} if loc else None,
        }
