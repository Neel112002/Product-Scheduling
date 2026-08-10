# services/swap_service.py
from datetime import datetime
from extensions import db
from models import ShiftSwap, ShiftAssignment, Shift, Employment, AppUser
from services.notification_service import NotificationService

notif_svc = NotificationService()


class SwapService:

    # ── Open swap — post to marketplace ───────────────────────────────────────
    def request_open(self, *, requesting_user_id: int, shift_id: int, reason: str = None) -> ShiftSwap:
        self._assert_assigned(shift_id, requesting_user_id)
        self._assert_shift_available(shift_id)
        self._assert_no_pending(shift_id, requesting_user_id)

        swap = ShiftSwap(
            shift_id=shift_id,
            requesting_user_id=requesting_user_id,
            swap_type="open",
            reason=reason,
            status="pending",
        )
        db.session.add(swap)
        db.session.commit()
        self._notify_location_staff(swap)
        return swap

    # ── Targeted swap — pick colleague + their shift ───────────────────────────
    def request_targeted(
        self, *,
        requesting_user_id: int,
        shift_id:           int,
        receiving_user_id:  int,
        offered_shift_id:   int,
        reason:             str = None,
    ) -> ShiftSwap:
        if requesting_user_id == receiving_user_id:
            raise ValueError("You cannot swap with yourself.")
        self._assert_assigned(shift_id, requesting_user_id)
        self._assert_assigned(offered_shift_id, receiving_user_id)
        self._assert_shift_available(shift_id)
        self._assert_shift_available(offered_shift_id)
        self._assert_no_pending(shift_id, requesting_user_id)

        swap = ShiftSwap(
            shift_id=shift_id,
            requesting_user_id=requesting_user_id,
            receiving_user_id=receiving_user_id,
            offered_shift_id=offered_shift_id,
            swap_type="targeted",
            reason=reason,
            status="pending",
        )
        db.session.add(swap)
        db.session.commit()

        # Notify the receiver
        requester = AppUser.query.get(requesting_user_id)
        shift     = Shift.query.get(shift_id)
        notif_svc.create(
            user_id=receiving_user_id,
            notif_type="swap_requested",
            title="Swap Request Received",
            body=(
                f"{requester.display_name or requester.username} wants to swap their shift on "
                f"{shift.start_time.strftime('%b %d at %I:%M %p')} with one of yours."
            ),
            data={"swap_id": swap.swap_id},
        )
        return swap

    # ── Make offer on open swap ───────────────────────────────────────────────
    def make_offer(self, *, user_id: int, swap_id: int, offered_shift_id: int) -> ShiftSwap:
        swap = self._get(swap_id)
        if swap.swap_type != "open":
            raise ValueError("This is a targeted swap — offers are not accepted.")
        if swap.requesting_user_id == user_id:
            raise ValueError("You cannot offer on your own swap.")
        if swap.status != "pending":
            raise ValueError("This swap is no longer open for offers.")

        self._assert_assigned(offered_shift_id, user_id)
        self._assert_shift_available(offered_shift_id)

        swap.receiving_user_id = user_id
        swap.offered_shift_id  = offered_shift_id
        swap.status            = "offer_pending"
        db.session.commit()

        # Notify requester
        offerer       = AppUser.query.get(user_id)
        offered_shift = Shift.query.get(offered_shift_id)
        notif_svc.create(
            user_id=swap.requesting_user_id,
            notif_type="swap_offer",
            title="Someone Offered a Swap",
            body=(
                f"{offerer.display_name or offerer.username} offered their shift on "
                f"{offered_shift.start_time.strftime('%b %d at %I:%M %p')} in exchange."
            ),
            data={"swap_id": swap_id},
        )
        return swap

    # ── Retract offer (back to open) ──────────────────────────────────────────
    def retract_offer(self, *, user_id: int, swap_id: int) -> ShiftSwap:
        swap = self._get(swap_id)
        if swap.receiving_user_id != user_id:
            raise PermissionError("You did not make this offer.")
        if swap.status != "offer_pending":
            raise ValueError("No active offer to retract.")
        swap.receiving_user_id = None
        swap.offered_shift_id  = None
        swap.status            = "pending"
        db.session.commit()
        return swap

    # ── Accept (open: requester accepts offer | targeted: receiver agrees) ────
    def accept(self, *, user_id: int, swap_id: int) -> ShiftSwap:
        swap = self._get(swap_id)

        if swap.swap_type == "open":
            # Requester must accept the offer
            if swap.requesting_user_id != user_id:
                raise PermissionError("Only the requester can accept an offer.")
            if swap.status != "offer_pending":
                raise ValueError("No pending offer to accept.")
        else:
            # Targeted: receiver accepts
            if swap.receiving_user_id != user_id:
                raise PermissionError("Only the intended receiver can accept.")
            if swap.status != "pending":
                raise ValueError("Swap is no longer pending.")

        swap.status = "accepted"
        db.session.commit()

        # Notify the other party
        other_id = swap.receiving_user_id if swap.requesting_user_id == user_id else swap.requesting_user_id
        accepter = AppUser.query.get(user_id)
        notif_svc.create(
            user_id=other_id,
            notif_type="swap_accepted",
            title="Swap Accepted",
            body=f"{accepter.display_name or accepter.username} accepted the swap. Waiting for manager approval.",
            data={"swap_id": swap_id},
        )
        # Notify managers
        shift = Shift.query.get(swap.shift_id)
        self._notify_managers_approval(swap, shift)
        return swap

    # ── Reject ────────────────────────────────────────────────────────────────
    def reject(self, *, user_id: int, swap_id: int) -> ShiftSwap:
        swap = self._get(swap_id)

        if swap.swap_type == "targeted" and swap.receiving_user_id == user_id:
            pass  # receiver rejects targeted swap
        elif swap.swap_type == "open" and swap.requesting_user_id == user_id and swap.status == "offer_pending":
            # Requester rejects the offer — back to open
            swap.receiving_user_id = None
            swap.offered_shift_id  = None
            swap.status            = "pending"
            db.session.commit()
            return swap
        else:
            raise PermissionError("Not authorized to reject this swap.")

        swap.status = "rejected"
        db.session.commit()

        notif_svc.create(
            user_id=swap.requesting_user_id,
            notif_type="swap_rejected",
            title="Swap Declined",
            body="Your swap request was declined.",
            data={"swap_id": swap_id},
        )
        return swap

    # ── Cancel (requester cancels) ────────────────────────────────────────────
    def cancel(self, *, user_id: int, swap_id: int) -> ShiftSwap:
        swap = self._get(swap_id)
        if swap.requesting_user_id != user_id:
            raise PermissionError("Only the requester can cancel.")
        if swap.status in ("approved", "rejected", "cancelled"):
            raise ValueError("Cannot cancel at this stage.")
        swap.status = "cancelled"
        db.session.commit()
        return swap

    # ── Manager approve/reject ────────────────────────────────────────────────
    def manager_decide(self, *, swap_id: int, manager_user_id: int, approve: bool) -> dict:
        swap = self._get(swap_id)
        if swap.status != "accepted":
            raise ValueError("Swap must be accepted by both parties first.")

        shift = Shift.query.get(swap.shift_id)
        self._assert_manager(manager_user_id, shift.location_id)

        conflicts = self.check_conflicts(swap)

        if approve:
            # Swap requester's shift → receiver
            req_assignment = ShiftAssignment.query.filter_by(
                shift_id=swap.shift_id, user_id=swap.requesting_user_id
            ).first()
            if req_assignment:
                req_assignment.user_id     = swap.receiving_user_id
                req_assignment.assigned_by = manager_user_id
                req_assignment.assigned_at = datetime.utcnow()

            # Swap receiver's shift → requester
            if swap.offered_shift_id:
                rec_assignment = ShiftAssignment.query.filter_by(
                    shift_id=swap.offered_shift_id, user_id=swap.receiving_user_id
                ).first()
                if rec_assignment:
                    rec_assignment.user_id     = swap.requesting_user_id
                    rec_assignment.assigned_by = manager_user_id
                    rec_assignment.assigned_at = datetime.utcnow()

            swap.status           = "approved"
            swap.manager_approved = True
        else:
            swap.status           = "rejected"
            swap.manager_approved = False

        db.session.commit()

        # Notify both parties
        status_word = "approved" if approve else "rejected"
        for uid in [swap.requesting_user_id, swap.receiving_user_id]:
            if uid:
                notif_svc.create(
                    user_id=uid,
                    notif_type=f"swap_{status_word}",
                    title=f"Swap {status_word.capitalize()}",
                    body=f"Your shift swap was {status_word} by the manager.",
                    data={"swap_id": swap_id},
                )

        return {"swap": swap, "conflicts": conflicts}

    # ── Conflict check ────────────────────────────────────────────────────────
    def check_conflicts(self, swap: ShiftSwap) -> dict:
        """Check if either party's new shift conflicts with their other assignments."""
        req_shift = Shift.query.get(swap.shift_id)       # requester gives this up
        off_shift = Shift.query.get(swap.offered_shift_id) if swap.offered_shift_id else None  # requester receives this

        conflicts = {"requester": [], "receiver": []}

        if off_shift:
            # Does requester's new shift (off_shift) conflict with their other shifts?
            req_others = (
                db.session.query(Shift)
                .join(ShiftAssignment, ShiftAssignment.shift_id == Shift.shift_id)
                .filter(
                    ShiftAssignment.user_id == swap.requesting_user_id,
                    Shift.shift_id != swap.shift_id,       # excluding the one they're giving up
                    Shift.status   == "published",
                )
                .all()
            )
            for s in req_others:
                if self._overlaps(off_shift, s):
                    conflicts["requester"].append({
                        "shift_id":   s.shift_id,
                        "start_time": s.start_time.isoformat(),
                        "end_time":   s.end_time.isoformat(),
                        "role":       s.role.name if s.role else None,
                    })

        if req_shift and swap.receiving_user_id:
            # Does receiver's new shift (req_shift) conflict with their other shifts?
            rec_others = (
                db.session.query(Shift)
                .join(ShiftAssignment, ShiftAssignment.shift_id == Shift.shift_id)
                .filter(
                    ShiftAssignment.user_id == swap.receiving_user_id,
                    Shift.shift_id != swap.offered_shift_id,  # excluding the one they're giving up
                    Shift.status   == "published",
                )
                .all()
            )
            for s in rec_others:
                if self._overlaps(req_shift, s):
                    conflicts["receiver"].append({
                        "shift_id":   s.shift_id,
                        "start_time": s.start_time.isoformat(),
                        "end_time":   s.end_time.isoformat(),
                        "role":       s.role.name if s.role else None,
                    })

        return conflicts

    # ── Queries ───────────────────────────────────────────────────────────────
    def get_my_swaps(self, user_id: int):
        return (
            ShiftSwap.query
            .filter_by(requesting_user_id=user_id)
            .order_by(ShiftSwap.created_at.desc())
            .all()
        )

    def get_incoming(self, user_id: int):
        """Targeted swaps where I'm the receiver OR open swaps where I made an offer."""
        return (
            ShiftSwap.query
            .filter(
                ShiftSwap.receiving_user_id == user_id,
                ShiftSwap.requesting_user_id != user_id,
            )
            .order_by(ShiftSwap.created_at.desc())
            .all()
        )

    def get_open_marketplace(self, location_id: int, exclude_user_id: int):
        """Open swaps from colleagues at this location."""
        return (
            db.session.query(ShiftSwap)
            .join(Shift, Shift.shift_id == ShiftSwap.shift_id)
            .filter(
                Shift.location_id          == location_id,
                ShiftSwap.swap_type        == "open",
                ShiftSwap.status           == "pending",
                ShiftSwap.requesting_user_id != exclude_user_id,
            )
            .order_by(ShiftSwap.created_at.desc())
            .all()
        )

    def get_pending_manager(self, location_id: int):
        return (
            db.session.query(ShiftSwap)
            .join(Shift, Shift.shift_id == ShiftSwap.shift_id)
            .filter(
                Shift.location_id == location_id,
                ShiftSwap.status  == "accepted",
            )
            .order_by(ShiftSwap.created_at.asc())
            .all()
        )

    def get_my_shifts_for_offer(self, user_id: int):
        """My upcoming published shifts that aren't already in a pending swap."""
        from datetime import timezone
        now = datetime.now(timezone.utc)
        shifts = (
            db.session.query(Shift)
            .join(ShiftAssignment, ShiftAssignment.shift_id == Shift.shift_id)
            .filter(
                ShiftAssignment.user_id == user_id,
                Shift.status            == "published",
                Shift.start_time        > now,
            )
            .all()
        )
        # Exclude shifts already in a pending swap
        in_swap = {
            s.shift_id for s in
            ShiftSwap.query.filter_by(requesting_user_id=user_id, status="pending").all()
        }
        return [s for s in shifts if s.shift_id not in in_swap]

    # ── Serialization ─────────────────────────────────────────────────────────
    def serialize(self, swap: ShiftSwap, include_conflicts: bool = False) -> dict:
        req_shift = Shift.query.get(swap.shift_id)
        off_shift = Shift.query.get(swap.offered_shift_id) if swap.offered_shift_id else None
        requester = AppUser.query.get(swap.requesting_user_id)
        receiver  = AppUser.query.get(swap.receiving_user_id) if swap.receiving_user_id else None

        result = {
            "swap_id":            swap.swap_id,
            "swap_type":          swap.swap_type,
            "status":             swap.status,
            "reason":             swap.reason,
            "manager_approved":   swap.manager_approved,
            "ai_suggested":       swap.ai_suggested,
            "created_at":         swap.created_at.isoformat(),

            "requester": {
                "user_id":      requester.user_id if requester else None,
                "name":         requester.display_name or requester.username if requester else None,
            },
            "receiver": {
                "user_id":      receiver.user_id if receiver else None,
                "name":         receiver.display_name or receiver.username if receiver else None,
            } if receiver else None,

            "shift": self._serialize_shift(req_shift),
            "offered_shift": self._serialize_shift(off_shift) if off_shift else None,
        }

        if include_conflicts:
            result["conflicts"] = self.check_conflicts(swap)

        return result

    @staticmethod
    def _serialize_shift(shift) -> dict | None:
        if not shift:
            return None
        return {
            "shift_id":      shift.shift_id,
            "start_time":    shift.start_time.isoformat(),
            "end_time":      shift.end_time.isoformat(),
            "break_minutes": shift.break_minutes,
            "role":          shift.role.name if shift.role else None,
            "location":      shift.location.loc_name if shift.location else None,
        }

    # ── Private helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _get(swap_id: int) -> ShiftSwap:
        swap = ShiftSwap.query.get(swap_id)
        if not swap:
            raise ValueError("Swap not found.")
        return swap

    @staticmethod
    def _assert_assigned(shift_id: int, user_id: int):
        if not ShiftAssignment.query.filter_by(shift_id=shift_id, user_id=user_id).first():
            raise ValueError("You are not assigned to this shift.")

    @staticmethod
    def _assert_shift_available(shift_id: int):
        shift = Shift.query.get(shift_id)
        if not shift or shift.status != "published":
            raise ValueError("Shift is not available for swapping.")

    @staticmethod
    def _assert_no_pending(shift_id: int, user_id: int):
        if ShiftSwap.query.filter_by(
            shift_id=shift_id, requesting_user_id=user_id, status="pending"
        ).first():
            raise ValueError("You already have a pending swap for this shift.")

    @staticmethod
    def _assert_manager(user_id: int, location_id: int):
        emp = Employment.query.filter_by(
            user_id=user_id, location_id=location_id, status="active"
        ).first()
        if not emp or (emp.role.name if emp.role else "").lower() not in ("owner", "manager"):
            raise PermissionError("Manager access required.")

    @staticmethod
    def _overlaps(s1: Shift, s2: Shift) -> bool:
        return s1.start_time < s2.end_time and s1.end_time > s2.start_time

    def _notify_location_staff(self, swap: ShiftSwap):
        shift     = Shift.query.get(swap.shift_id)
        requester = AppUser.query.get(swap.requesting_user_id)
        name      = requester.display_name or requester.username
        emps = Employment.query.filter(
            Employment.location_id == shift.location_id,
            Employment.status      == "active",
            Employment.user_id     != swap.requesting_user_id,
        ).all()
        for emp in emps:
            notif_svc.create(
                user_id=emp.user_id,
                notif_type="swap_requested",
                title="Shift Available for Swap",
                body=(
                    f"{name} is looking to swap their shift on "
                    f"{shift.start_time.strftime('%b %d at %I:%M %p')}. "
                    f"Offer one of your shifts in return."
                ),
                data={"swap_id": swap.swap_id},
            )

    def _notify_managers_approval(self, swap: ShiftSwap, shift: Shift):
        emps = Employment.query.filter_by(location_id=shift.location_id, status="active").all()
        managers = [e for e in emps if e.role and e.role.name.lower() in ("owner", "manager")]
        req  = AppUser.query.get(swap.requesting_user_id)
        recv = AppUser.query.get(swap.receiving_user_id)
        for mgr in managers:
            notif_svc.create(
                user_id=mgr.user_id,
                notif_type="swap_needs_approval",
                title="Swap Needs Approval",
                body=(
                    f"{req.display_name or req.username} ↔ "
                    f"{recv.display_name or recv.username} agreed to swap shifts. Tap to review."
                ),
                data={"swap_id": swap.swap_id},
            )