# services/swap_service.py
from datetime import datetime, timedelta
from typing import List, Optional
from extensions import db
from models import ShiftSwap, ShiftAssignment, Shift, Employment, AppUser
from services.notification_service import NotificationService
from utils.socket_events import emit_swap_requested, emit_swap_status_changed

notif_svc = NotificationService()


class SwapService:

    def request_swap(self, *, requesting_user_id, shift_id, reason=None):
        if not ShiftAssignment.query.filter_by(
            shift_id=shift_id, user_id=requesting_user_id
        ).first():
            raise ValueError("You are not assigned to this shift")
        shift = Shift.query.get(shift_id)
        if not shift or shift.status != "published":
            raise ValueError("Shift is not available for swapping")
        if ShiftSwap.query.filter_by(
            shift_id=shift_id, requesting_user_id=requesting_user_id, status="pending"
        ).first():
            raise ValueError("You already have a pending swap for this shift")

        swap = ShiftSwap(
            shift_id=shift_id,
            requesting_user_id=requesting_user_id,
            reason=reason,
            status="pending",
        )
        db.session.add(swap)
        db.session.commit()
        self._notify_eligible_staff(swap, shift)
        return swap

    def accept_swap(self, *, swap_id, receiving_user_id):
        swap = self._get_swap(swap_id)
        if swap.status != "pending":
            raise ValueError("Swap is no longer pending")
        if swap.requesting_user_id == receiving_user_id:
            raise ValueError("You cannot accept your own swap request")
        shift = Shift.query.get(swap.shift_id)
        if not Employment.query.filter_by(
            user_id=receiving_user_id, location_id=shift.location_id, status="active"
        ).first():
            raise ValueError("You are not employed at this location")

        swap.receiving_user_id = receiving_user_id
        swap.status = "accepted"
        db.session.commit()

        receiver = AppUser.query.get(receiving_user_id)
        emit_swap_status_changed(swap.requesting_user_id, swap_id, "accepted")
        notif_svc.create(
            user_id=swap.requesting_user_id,
            notif_type="swap_accepted",
            title="Swap Accepted",
            body=f"{receiver.display_name or receiver.username} accepted your swap. Waiting for manager approval.",
            data={"swap_id": swap_id},
        )
        requester = AppUser.query.get(swap.requesting_user_id)
        self._notify_managers(shift.location_id, swap_id, requester, receiver)
        return swap

    def reject_swap(self, *, swap_id, user_id):
        swap = self._get_swap(swap_id)
        if swap.receiving_user_id != user_id:
            raise ValueError("Not authorized to reject this swap")
        swap.status = "rejected"
        db.session.commit()
        emit_swap_status_changed(swap.requesting_user_id, swap_id, "rejected")
        return swap

    def manager_approve(self, *, swap_id, manager_user_id, approve: bool):
        swap = self._get_swap(swap_id)
        if swap.status != "accepted":
            raise ValueError("Swap must be accepted by both parties first")
        shift = Shift.query.get(swap.shift_id)
        self._assert_manager(manager_user_id, shift.location_id)

        if approve:
            assignment = ShiftAssignment.query.filter_by(
                shift_id=swap.shift_id, user_id=swap.requesting_user_id
            ).first()
            if assignment:
                assignment.user_id     = swap.receiving_user_id
                assignment.assigned_by = manager_user_id
                assignment.assigned_at = datetime.utcnow()
            swap.status           = "approved"
            swap.manager_approved = True
        else:
            swap.status           = "rejected"
            swap.manager_approved = False

        db.session.commit()
        status = "approved" if approve else "rejected"
        emit_swap_status_changed(swap.requesting_user_id, swap_id, status)
        if swap.receiving_user_id:
            emit_swap_status_changed(swap.receiving_user_id, swap_id, status)
        return swap

    def get_my_swaps(self, user_id: int):
        return ShiftSwap.query.filter(
            db.or_(
                ShiftSwap.requesting_user_id == user_id,
                ShiftSwap.receiving_user_id  == user_id,
            )
        ).order_by(ShiftSwap.created_at.desc()).all()

    def get_pending_for_manager(self, location_id: int):
        return (
            db.session.query(ShiftSwap)
            .join(Shift, Shift.shift_id == ShiftSwap.shift_id)
            .filter(Shift.location_id == location_id, ShiftSwap.status == "accepted")
            .order_by(ShiftSwap.created_at.asc())
            .all()
        )

    @staticmethod
    def serialize(swap: ShiftSwap) -> dict:
        return {
            "swap_id":            swap.swap_id,
            "shift_id":           swap.shift_id,
            "requesting_user_id": swap.requesting_user_id,
            "receiving_user_id":  swap.receiving_user_id,
            "reason":             swap.reason,
            "status":             swap.status,
            "manager_approved":   swap.manager_approved,
            "ai_suggested":       swap.ai_suggested,
            "created_at":         swap.created_at.isoformat(),
        }

    @staticmethod
    def _get_swap(swap_id):
        swap = ShiftSwap.query.get(swap_id)
        if not swap:
            raise ValueError("Swap not found")
        return swap

    @staticmethod
    def _assert_manager(user_id, location_id):
        emp = Employment.query.filter_by(
            user_id=user_id, location_id=location_id, status="active"
        ).first()
        if not emp or (emp.role.name if emp.role else "").lower() not in ("owner", "manager"):
            raise PermissionError("Manager required to approve swaps")

    def _notify_eligible_staff(self, swap, shift):
        emps = Employment.query.filter(
            Employment.location_id == shift.location_id,
            Employment.status == "active",
            Employment.user_id != swap.requesting_user_id,
        ).all()
        requester = AppUser.query.get(swap.requesting_user_id)
        name = requester.display_name or requester.username
        for emp in emps:
            emit_swap_requested(emp.user_id, swap.swap_id, name)
            notif_svc.create(
                user_id=emp.user_id,
                notif_type="swap_requested",
                title="Shift Available for Swap",
                body=f"{name} is looking for someone to cover their shift on {shift.start_time.strftime('%b %d at %I:%M %p')}.",
                data={"swap_id": swap.swap_id, "shift_id": shift.shift_id},
            )

    def _notify_managers(self, location_id, swap_id, requester, receiver):
        all_emps = Employment.query.filter_by(
            location_id=location_id, status="active"
        ).all()
        manager_emps = [
            e for e in all_emps
            if e.role and e.role.name.lower() in ("owner", "manager")
        ]
        for emp in manager_emps:
            notif_svc.create(
                user_id=emp.user_id,
                notif_type="swap_needs_approval",
                title="Swap Needs Approval",
                body=(
                    f"{requester.display_name or requester.username} and "
                    f"{receiver.display_name or receiver.username} "
                    f"want to swap a shift. Tap to approve."
                ),
                data={"swap_id": swap_id},
            )