# services/shift_service.py
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.exc import IntegrityError
from extensions import db
from models import Shift, ShiftAssignment, AppUser, Location, Employment, Role
from services.notification_service import NotificationService
from utils.socket_events import (
    emit_shift_updated, emit_shift_assigned,
    emit_schedule_published, emit_labor_cost_update,
)

notif_svc = NotificationService()


class ShiftService:

    # ── Create ────────────────────────────────────────────────────────────────
    def create_shift(self, *, caller_user_id, location_id, start_time,
                     end_time, role_id=None, break_minutes=0,
                     notes=None, created_by_ai=False):
        self._assert_manager(caller_user_id, location_id)
        self._assert_times(start_time, end_time)

        shift = Shift(
            location_id=location_id,
            role_id=role_id,
            start_time=start_time,
            end_time=end_time,
            break_minutes=break_minutes,
            notes=notes,
            status="draft",
            created_by_ai=created_by_ai,
            created_by=caller_user_id if not created_by_ai else None,
        )
        db.session.add(shift)
        db.session.commit()
        emit_shift_updated(location_id, shift.shift_id, "created")
        return shift

    # ── Read ──────────────────────────────────────────────────────────────────
    def get_shifts(self, *, caller_user_id, location_id,
                   week_start=None, status=None):
        self._assert_member(caller_user_id, location_id)
        q = Shift.query.filter_by(location_id=location_id)
        if week_start:
            try:
                ws = datetime.strptime(week_start, "%Y-%m-%d")
                we = ws + timedelta(days=7)
                q = q.filter(Shift.start_time >= ws, Shift.start_time < we)
            except ValueError:
                pass
        if status:
            q = q.filter_by(status=status)
        return q.order_by(Shift.start_time.asc()).all()

    def get_shift(self, shift_id: int, caller_user_id: int):
        shift = Shift.query.get(shift_id)
        if not shift:
            raise ValueError("Shift not found")
        self._assert_member(caller_user_id, shift.location_id)
        return shift

    def get_my_shifts(self, user_id: int, week_start=None):
        q = (
            db.session.query(Shift)
            .join(ShiftAssignment, ShiftAssignment.shift_id == Shift.shift_id)
            .filter(ShiftAssignment.user_id == user_id, Shift.status == "published")
        )
        if week_start:
            try:
                ws = datetime.strptime(week_start, "%Y-%m-%d")
                we = ws + timedelta(days=7)
                q = q.filter(Shift.start_time >= ws, Shift.start_time < we)
            except ValueError:
                pass
        return q.order_by(Shift.start_time.asc()).all()

    # ── Update ────────────────────────────────────────────────────────────────
    def update_shift(self, *, shift_id, caller_user_id, start_time=None,
                     end_time=None, role_id=None, break_minutes=None, notes=None):
        shift = Shift.query.get(shift_id)
        if not shift:
            raise ValueError("Shift not found")
        self._assert_manager(caller_user_id, shift.location_id)
        if shift.status == "cancelled":
            raise ValueError("Cannot edit a cancelled shift")
        if start_time:    shift.start_time    = start_time
        if end_time:      shift.end_time      = end_time
        if role_id is not None:       shift.role_id       = role_id
        if break_minutes is not None: shift.break_minutes = break_minutes
        if notes is not None:         shift.notes         = notes
        if start_time or end_time:
            self._assert_times(shift.start_time, shift.end_time)
        db.session.commit()
        emit_shift_updated(shift.location_id, shift.shift_id, "updated")
        return shift

    # ── Cancel ────────────────────────────────────────────────────────────────
    def cancel_shift(self, *, shift_id, caller_user_id):
        shift = Shift.query.get(shift_id)
        if not shift:
            raise ValueError("Shift not found")
        self._assert_manager(caller_user_id, shift.location_id)
        shift.status = "cancelled"
        db.session.commit()
        for assignment in shift.assignments:
            notif_svc.create(
                user_id=assignment.user_id,
                notif_type="shift_cancelled",
                title="Shift Cancelled",
                body=f"Your shift on {shift.start_time.strftime('%b %d at %I:%M %p')} has been cancelled.",
                data={"shift_id": shift_id},
            )
        emit_shift_updated(shift.location_id, shift.shift_id, "cancelled")
        return shift

    # ── Assign ────────────────────────────────────────────────────────────────
    def assign_user(self, *, shift_id, user_id, caller_user_id):
        shift = Shift.query.get(shift_id)
        if not shift:
            raise ValueError("Shift not found")
        self._assert_manager(caller_user_id, shift.location_id)
        emp = Employment.query.filter_by(
            user_id=user_id, location_id=shift.location_id, status="active"
        ).first()
        if not emp:
            raise ValueError("User is not an active employee at this location")
        if ShiftAssignment.query.filter_by(shift_id=shift_id, user_id=user_id).first():
            raise ValueError("User is already assigned to this shift")
        assignment = ShiftAssignment(
            shift_id=shift_id, user_id=user_id, assigned_by=caller_user_id
        )
        db.session.add(assignment)
        db.session.commit()
        emit_shift_assigned(user_id, shift_id, shift.start_time.isoformat())
        notif_svc.create(
            user_id=user_id,
            notif_type="shift_assigned",
            title="New Shift",
            body=f"You have been scheduled for {shift.start_time.strftime('%A, %b %d at %I:%M %p')}.",
            data={"shift_id": shift_id},
        )
        return assignment

    def unassign_user(self, *, shift_id, user_id, caller_user_id):
        shift = Shift.query.get(shift_id)
        if not shift:
            raise ValueError("Shift not found")
        self._assert_manager(caller_user_id, shift.location_id)
        assignment = ShiftAssignment.query.filter_by(
            shift_id=shift_id, user_id=user_id
        ).first()
        if not assignment:
            raise ValueError("Assignment not found")
        db.session.delete(assignment)
        db.session.commit()
        emit_shift_updated(shift.location_id, shift_id, "unassigned")
        return True

    # ── Publish ───────────────────────────────────────────────────────────────
    def publish_week(self, *, caller_user_id, location_id, week_start):
        self._assert_manager(caller_user_id, location_id)
        ws = datetime.strptime(week_start, "%Y-%m-%d")
        we = ws + timedelta(days=7)
        drafts = Shift.query.filter(
            Shift.location_id == location_id,
            Shift.status == "draft",
            Shift.start_time >= ws,
            Shift.start_time < we,
        ).all()
        if not drafts:
            raise ValueError("No draft shifts found for this week")
        now = datetime.utcnow()
        for shift in drafts:
            shift.status       = "published"
            shift.published_at = now
        db.session.commit()
        count = len(drafts)
        emit_schedule_published(location_id, week_start, count)
        notif_svc.notify_location_staff(
            location_id=location_id,
            notif_type="schedule_published",
            title="Schedule Published",
            body=f"The schedule for week of {ws.strftime('%b %d')} is now available.",
            data={"week_start": week_start, "location_id": location_id},
        )
        return count

    # ── Labor cost ────────────────────────────────────────────────────────────
    def get_labor_cost(self, *, location_id, week_start, hourly_rate=15.0):
        ws = datetime.strptime(week_start, "%Y-%m-%d")
        we = ws + timedelta(days=7)
        shifts = Shift.query.filter(
            Shift.location_id == location_id,
            Shift.status.in_(["draft", "published"]),
            Shift.start_time >= ws,
            Shift.start_time < we,
        ).all()
        total_minutes = 0
        for shift in shifts:
            duration = (shift.end_time - shift.start_time).total_seconds() / 60
            total_minutes += max(duration - shift.break_minutes, 0)
        total_hours = total_minutes / 60
        total_cost  = total_hours * hourly_rate
        return {
            "location_id":  location_id,
            "week_start":   week_start,
            "total_shifts": len(shifts),
            "total_hours":  round(total_hours, 2),
            "total_cost":   round(total_cost, 2),
            "hourly_rate":  hourly_rate,
        }

    # ── Serialize ─────────────────────────────────────────────────────────────
    @staticmethod
    def serialize(shift: Shift) -> dict:
        return {
            "shift_id":      shift.shift_id,
            "location_id":   shift.location_id,
            "role":          shift.role.name if shift.role else None,
            "start_time":    shift.start_time.isoformat(),
            "end_time":      shift.end_time.isoformat(),
            "break_minutes": shift.break_minutes,
            "notes":         shift.notes,
            "status":        shift.status,
            "created_by_ai": shift.created_by_ai,
            "published_at":  shift.published_at.isoformat() if shift.published_at else None,
            "assignments": [
                {"user_id": a.user_id, "assigned_at": a.assigned_at.isoformat()}
                for a in shift.assignments
            ],
        }

    # ── Guards ────────────────────────────────────────────────────────────────
    @staticmethod
    def _assert_manager(user_id, location_id):
        emp = Employment.query.filter_by(
            user_id=user_id, location_id=location_id, status="active"
        ).first()
        if not emp:
            raise PermissionError("Not an employee at this location")
        if (emp.role.name if emp.role else "").lower() not in ("owner", "manager", "supervisor"):
            raise PermissionError("Manager or above required")

    @staticmethod
    def _assert_member(user_id, location_id):
        if not Employment.query.filter_by(
            user_id=user_id, location_id=location_id, status="active"
        ).first():
            raise PermissionError("Not an employee at this location")

    @staticmethod
    def _assert_times(start, end):
        if start >= end:
            raise ValueError("start_time must be before end_time")