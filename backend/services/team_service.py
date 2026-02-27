from models import AppUser, Employment


class TeamService:

    def get_team_members(self, *, requester_id: int, location_id: int):

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

        if requester_emp.role.name.lower() not in ("owner", "manager"):
            raise PermissionError("Forbidden")

        users = (
            AppUser.query
            .join(Employment)
            .filter(Employment.location_id == location_id)
            .all()
        )

        return users