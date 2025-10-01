# services/registration_service.py
from typing import Tuple, Dict
from sqlalchemy.exc import IntegrityError
from extensions import db
from models import Company, Location, AppUser, Employment
from utils.security import hash_password

class RegistrationService:
    """
    Handles the multi-step signup wizard in a single DB transaction.
    Professional order: 1) Owner Account, 2) Company, 3) First Location.
    """

    REQUIRED_OWNER = ("username", "email", "password", "confirm_password")
    REQUIRED_COMPANY = ("name", "email", "address", "city", "country", "postal_code")
    REQUIRED_LOCATION = ("name", "address", "postal_code")

    @staticmethod
    def _fmt_company_address(address: str, city: str, country: str, postal: str) -> str:
        parts = [address, city, country, postal]
        return ", ".join([p for p in parts if p])

    @staticmethod
    def _fmt_location_address(address: str, postal: str) -> str:
        return f"{address}, {postal}"

    def register_wizard(self, payload: Dict) -> Tuple[Company, Location, AppUser]:
        """
        Expected payload structure (Account -> Company -> Location):

        {
          "owner":   {"username": "...", "email": "...", "password": "...", "confirm_password": "..."},
          "company": {"name": "...", "email": "...", "address": "...", "city": "...", "country": "...", "postal_code": "..."},
          "location":{"name": "...", "address": "...", "postal_code": "..."}
        }
        """
        owner = (payload or {}).get("owner") or {}
        company = (payload or {}).get("company") or {}
        location = (payload or {}).get("location") or {}

        # Validate presence
        missing = {}
        mo = [k for k in self.REQUIRED_OWNER if k not in owner]
        mc = [k for k in self.REQUIRED_COMPANY if k not in company]
        ml = [k for k in self.REQUIRED_LOCATION if k not in location]
        if mo: missing["owner"] = f"Missing: {', '.join(mo)}"
        if mc: missing["company"] = f"Missing: {', '.join(mc)}"
        if ml: missing["location"] = f"Missing: {', '.join(ml)}"
        if missing:
            raise ValueError(missing)

        # Validate confirm password
        if owner["password"] != owner["confirm_password"]:
            raise ValueError({"owner": "password and confirm_password do not match"})

        comp_addr = self._fmt_company_address(
            company["address"].strip(),
            company["city"].strip(),
            company["country"].strip(),
            company["postal_code"].strip(),
        )
        loc_addr = self._fmt_location_address(
            location["address"].strip(),
            location["postal_code"].strip(),
        )

        try:
            with db.session.begin():
                # 1) Owner account
                user = AppUser(
                    username=owner["username"].strip(),
                    user_email=owner["email"].strip(),
                    user_password=hash_password(owner["password"]),
                    is_verified=False,
                )
                db.session.add(user)
                db.session.flush()  # user_id

                # 2) Company
                comp = Company(
                    comp_name=company["name"].strip(),
                    comp_email=company["email"].strip(),
                    comp_address=comp_addr,
                    is_verified=False,
                )
                db.session.add(comp)
                db.session.flush()  # comp_id

                # 3) First Location
                loc = Location(
                    comp_id=comp.comp_id,
                    loc_name=location["name"].strip(),
                    loc_address=loc_addr,
                )
                db.session.add(loc)
                db.session.flush()  # loc_id

                # Employment link (owner ↔ company/location)
                emp = Employment(
                    user_id=user.user_id,
                    comp_id=comp.comp_id,
                    location_id=loc.loc_id,
                    position="Owner",
                    status="active",
                )
                db.session.add(emp)

            return comp, loc, user

        except IntegrityError:
            db.session.rollback()
            # Likely duplicate emails (CITEXT unique) for owner or company.
            raise ValueError("Duplicate email: owner or company email already exists.")
