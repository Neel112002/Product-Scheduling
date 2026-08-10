# services/drop_service.py
from datetime import datetime
from extensions import db
from models import ShiftDrop, ShiftAssignment, Shift, Employment, AppUser
from services.notification_service import NotificationService

notif_svc = NotificationService()


class DropService:

    def request_drop(self, *, user_id: int, shift_id: int, reason: str = None) -> ShiftDrop:
        if not ShiftAssignment.query.filter_by(shift_id=shift_id, user_id=user_id).first():
            raise ValueError("You are not assigned to this shift.")

        shift = Shift.query.get(shift_id)
        if not shift or shift.status != "published":
            raise ValueError("Shift is not available to drop.")

        if ShiftDrop.query.filter_by(shift_id=shift_id, user_id=user_id, status="pending").first():
            raise ValueError("You already have a pending drop request for this shift.")

        drop = ShiftDrop(shift_id=shift_id, user_id=user_id, reason=reason, status="pending")
        db.session.add(drop)
        db.session.commit()
        self._notify_managers(drop, shift)
        return drop

    def cancel_drop(self, *, drop_id: int, user_id: int) -> ShiftDrop:
        drop = self._get_drop(drop_id)
        if drop.user_id != user_id:
            raise PermissionError("Not authorized.")
        if drop.status != "pending":
            raise ValueError("Only pending drops can be cancelled.")
        drop.status = "cancelled"
        db.session.commit()
        return drop

    def manager_decide(self, *, drop_id: int, manager_user_id: int, approve: bool) -> ShiftDrop:
        drop  = self._get_drop(drop_id)
        shift = Shift.query.get(drop.shift_id)
        self._assert_manager(manager_user_id, shift.location_id)

        if drop.status != "pending":
            raise ValueError("Drop request is no longer pending.")

        if approve:
            assignment = ShiftAssignment.query.filter_by(
                shift_id=drop.shift_id, user_id=drop.user_id
            ).first()
            if assignment:
                db.session.delete(assignment)
            drop.status = "approved"
        else:
            drop.status = "rejected"

        db.session.commit()

        shift = Shift.query.get(drop.shift_id)
        status_word = "approved" if approve else "rejected"
        notif_svc.create(
            user_id=drop.user_id,
            notif_type=f"drop_{status_word}",
            title=f"Drop Request {status_word.capitalize()}",
            body=(
                f"Your request to drop the shift on "
                f"{shift.start_time.strftime('%b %d at %I:%M %p')} "
                f"was {status_word}."
            ),
            data={"drop_id": drop_id, "shift_id": drop.shift_id},
        )
        return drop

    def get_my_drops(self, user_id: int):
        return (
            ShiftDrop.query
            .filter_by(user_id=user_id)
            .order_by(ShiftDrop.created_at.desc())
            .all()
        )

    def get_pending_for_manager(self, location_id: int):
        return (
            db.session.query(ShiftDrop)
            .join(Shift, Shift.shift_id == ShiftDrop.shift_id)
            .filter(
                Shift.location_id == location_id,
                ShiftDrop.status  == "pending",
            )
            .order_by(ShiftDrop.created_at.asc())
            .all()
        )

    @staticmethod
    def serialize(drop: ShiftDrop) -> dict:
        shift = Shift.query.get(drop.shift_id)
        return {
            "drop_id":    drop.drop_id,
            "shift_id":   drop.shift_id,
            "user_id":    drop.user_id,
            "reason":     drop.reason,
            "status":     drop.status,
            "created_at": drop.created_at.isoformat(),
            "shift": {
                "start_time":    shift.start_time.isoformat() if shift else None,
                "end_time":      shift.end_time.isoformat()   if shift else None,
                "role":          shift.role.name              if shift and shift.role else None,
                "break_minutes": shift.break_minutes          if shift else 0,
            } if shift else None,
        }

    @staticmethod
    def _get_drop(drop_id: int) -> ShiftDrop:
        drop = ShiftDrop.query.get(drop_id)
        if not drop:
            raise ValueError("Drop request not found.")
        return drop

    @staticmethod
    def _assert_manager(user_id: int, location_id: int):
        emp = Employment.query.filter_by(
            user_id=user_id, location_id=location_id, status="active"
        ).first()
        if not emp or (emp.role.name if emp.role else "").lower() not in ("owner", "manager"):
            raise PermissionError("Manager access required.")

    def _notify_managers(self, drop: ShiftDrop, shift: Shift):
        emps = Employment.query.filter_by(
            location_id=shift.location_id, status="active"
        ).all()
        manager_emps = [
            e for e in emps
            if e.role and e.role.name.lower() in ("owner", "manager")
        ]
        employee = AppUser.query.get(drop.user_id)
        name = employee.display_name or employee.username
        for emp in manager_emps:
            notif_svc.create(
                user_id=emp.user_id,
                notif_type="drop_requested",
                title="Shift Drop Request",
                body=(
                    f"{name} wants to drop their shift on "
                    f"{shift.start_time.strftime('%b %d at %I:%M %p')}. "
                    f"Tap to review."
                ),
                data={"drop_id": drop.drop_id, "shift_id": shift.shift_id},
            )