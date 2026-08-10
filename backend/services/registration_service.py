# services/registration_service.py
from datetime import date
from typing import Tuple, Dict
from sqlalchemy.exc import IntegrityError
from extensions import db
from models import Company, Location, AppUser, Employment, Role
from utils.security import hash_password


class RegistrationService:
    REQUIRED_OWNER    = ("username", "email", "password", "confirm_password")
    REQUIRED_COMPANY  = ("name", "email", "address", "city", "country", "postal_code")
    REQUIRED_LOCATION = ("name", "address", "postal_code")
    SYSTEM_ROLES      = ["Owner", "Manager", "Supervisor", "Staff"]

    @staticmethod
    def _fmt_company_address(address, city, country, postal):
        return ", ".join([p for p in [address, city, country, postal] if p])

    @staticmethod
    def _fmt_location_address(address, postal):
        return f"{address}, {postal}"

    def register_wizard(self, payload: Dict) -> Tuple[Company, Location, AppUser]:
        owner_d    = (payload or {}).get("owner")    or {}
        company_d  = (payload or {}).get("company")  or {}
        location_d = (payload or {}).get("location") or {}

        missing = {}
        mo = [k for k in self.REQUIRED_OWNER    if k not in owner_d]
        mc = [k for k in self.REQUIRED_COMPANY  if k not in company_d]
        ml = [k for k in self.REQUIRED_LOCATION if k not in location_d]
        if mo: missing["owner"]    = f"Missing: {', '.join(mo)}"
        if mc: missing["company"]  = f"Missing: {', '.join(mc)}"
        if ml: missing["location"] = f"Missing: {', '.join(ml)}"
        if missing:
            raise ValueError(missing)

        if owner_d["password"] != owner_d["confirm_password"]:
            raise ValueError({"owner": "password and confirm_password do not match"})

        comp_addr = self._fmt_company_address(
            company_d["address"].strip(), company_d["city"].strip(),
            company_d["country"].strip(), company_d["postal_code"].strip(),
        )
        loc_addr = self._fmt_location_address(
            location_d["address"].strip(), location_d["postal_code"].strip()
        )
        timezone = location_d.get("timezone", "UTC")

        try:
            with db.session.begin():
                user = AppUser(
                    username=owner_d["username"].strip(),
                    user_email=owner_d["email"].strip(),
                    user_password=hash_password(owner_d["password"]),
                    is_verified=False,
                )
                db.session.add(user)
                db.session.flush()

                comp = Company(
                    comp_name=company_d["name"].strip(),
                    comp_email=company_d["email"].strip(),
                    comp_address=comp_addr,
                    is_verified=False,
                    plan="free",
                )
                db.session.add(comp)
                db.session.flush()

                loc = Location(
                    comp_id=comp.comp_id,
                    loc_name=location_d["name"].strip(),
                    loc_address=loc_addr,
                    timezone=timezone,
                )
                db.session.add(loc)
                db.session.flush()

                # Create system roles for this location
                roles = {}
                for role_name in self.SYSTEM_ROLES:
                    role = Role(
                        name=role_name,
                        location_id=loc.loc_id,
                        is_system=True,
                        created_by=user.user_id,
                    )
                    db.session.add(role)
                    db.session.flush()
                    roles[role_name] = role

                emp = Employment(
                    user_id=user.user_id,
                    comp_id=comp.comp_id,
                    location_id=loc.loc_id,
                    role_id=roles["Owner"].role_id,
                    status="active",
                    start_date=date.today(),
                )
                db.session.add(emp)

            return comp, loc, user

        except IntegrityError:
            db.session.rollback()
            raise ValueError("Duplicate email: owner or company email already exists.")