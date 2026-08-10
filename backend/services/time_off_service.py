# services/time_off_service.py
from datetime import date, datetime
from extensions import db
from models import TimeOffRequest, Employment, AppUser
from services.notification_service import NotificationService

notif_svc = NotificationService()


class TimeOffService:

    def request(
        self, *,
        user_id:      int,
        start_date:   date,
        end_date:     date,
        request_type: str = "vacation",
        reason:       str = None,
    ) -> TimeOffRequest:
        if end_date < start_date:
            raise ValueError("End date must be on or after start date.")

        valid_types = ("vacation", "sick", "personal", "other")
        if request_type not in valid_types:
            raise ValueError(f"Type must be one of: {', '.join(valid_types)}")

        emp = Employment.query.filter_by(user_id=user_id, status="active").first()
        if not emp:
            raise ValueError("No active employment found.")

        req = TimeOffRequest(
            user_id=user_id,
            comp_id=emp.comp_id,
            start_date=start_date,
            end_date=end_date,
            request_type=request_type,
            reason=reason,
            status="pending",
        )
        db.session.add(req)
        db.session.commit()
        self._notify_managers(req, emp)
        return req

    def cancel(self, *, request_id: int, user_id: int) -> TimeOffRequest:
        req = self._get(request_id)
        if req.user_id != user_id:
            raise PermissionError("Not authorized.")
        if req.status != "pending":
            raise ValueError("Only pending requests can be cancelled.")
        req.status = "cancelled"
        db.session.commit()
        return req

    def decide(
        self, *,
        request_id:    int,
        manager_id:    int,
        approve:       bool,
        manager_notes: str = None,
    ) -> TimeOffRequest:
        req = self._get(request_id)
        if req.status != "pending":
            raise ValueError("Request is no longer pending.")

        emp = Employment.query.filter_by(
            user_id=manager_id, comp_id=req.comp_id, status="active"
        ).first()
        if not emp or (emp.role.name if emp.role else "").lower() not in ("owner", "manager"):
            raise PermissionError("Manager access required.")

        req.status        = "approved" if approve else "rejected"
        req.manager_notes = manager_notes
        db.session.commit()

        status_word = "approved" if approve else "rejected"
        notif_svc.create(
            user_id=req.user_id,
            notif_type=f"time_off_{status_word}",
            title=f"Time Off {status_word.capitalize()}",
            body=(
                f"Your time off request from "
                f"{req.start_date.strftime('%b %d')} to {req.end_date.strftime('%b %d')} "
                f"was {status_word}."
                + (f" Note: {manager_notes}" if manager_notes else "")
            ),
            data={"request_id": request_id},
        )
        return req

    def get_mine(self, user_id: int):
        return (
            TimeOffRequest.query
            .filter_by(user_id=user_id)
            .order_by(TimeOffRequest.created_at.desc())
            .all()
        )

    def get_pending_for_manager(self, comp_id: int):
        return (
            TimeOffRequest.query
            .filter_by(comp_id=comp_id, status="pending")
            .order_by(TimeOffRequest.created_at.asc())
            .all()
        )

    @staticmethod
    def serialize(req: TimeOffRequest) -> dict:
        days = (req.end_date - req.start_date).days + 1
        return {
            "request_id":    req.request_id,
            "user_id":       req.user_id,
            "start_date":    req.start_date.isoformat(),
            "end_date":      req.end_date.isoformat(),
            "days":          days,
            "request_type":  req.request_type,
            "reason":        req.reason,
            "status":        req.status,
            "manager_notes": req.manager_notes,
            "created_at":    req.created_at.isoformat(),
        }

    @staticmethod
    def _get(request_id: int) -> TimeOffRequest:
        req = TimeOffRequest.query.get(request_id)
        if not req:
            raise ValueError("Time off request not found.")
        return req

    def _notify_managers(self, req: TimeOffRequest, emp: Employment):
        all_emps = Employment.query.filter_by(comp_id=emp.comp_id, status="active").all()
        managers = [e for e in all_emps if e.role and e.role.name.lower() in ("owner", "manager")]
        employee = AppUser.query.get(req.user_id)
        name = employee.display_name or employee.username
        type_label = req.request_type.replace("_", " ").title()
        for mgr in managers:
            notif_svc.create(
                user_id=mgr.user_id,
                notif_type="time_off_requested",
                title="Time Off Request",
                body=(
                    f"{name} requested {type_label} from "
                    f"{req.start_date.strftime('%b %d')} to {req.end_date.strftime('%b %d')}."
                ),
                data={"request_id": req.request_id},
            )