# services/team_service.py

from typing import List
from extensions import db
from models import AppUser, Employment, Location


class TeamService:

    def get_team_members(self, *, requester_id: int, location_id: int) -> List[dict]:

        # 1️⃣ Check location exists
        location = Location.query.filter_by(loc_id=location_id).first()
        if not location:
            return []

        # 2️⃣ Check requester permission
        requester_emp = (
            Employment.query
            .filter_by(
                user_id=requester_id,
                location_id=location_id,
                status="active"
            )
            .first()
        )

        if not requester_emp:
            raise PermissionError("Forbidden")

        if (requester_emp.position or "").lower() not in ("owner", "manager"):
            raise PermissionError("Forbidden")

        # 3️⃣ Optimized join query (no N+1)
        results = (
            db.session.query(AppUser, Employment)
            .join(Employment, Employment.user_id == AppUser.user_id)
            .filter(Employment.location_id == location_id)
            .all()
        )

        members = []

        for user, emp in results:
            members.append({
                "id": user.user_id,
                "user_id": user.user_id,
                "username": user.username,
                "user_email": user.user_email,
                "display_name": user.display_name,
                "role": emp.position.lower() if emp.position else None,
                "isActive": bool(emp.status == "active"),  # 🔥 ALWAYS BOOLEAN
                "company": None,
                "primaryLocation": None,
            })

        return members