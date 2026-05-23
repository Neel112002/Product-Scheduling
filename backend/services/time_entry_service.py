# services/time_entry_service.py
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from extensions import db
from models import TimeEntry, BreakEntry, Shift, ShiftAssignment, Company, Employment


class TimeEntryService:

    # ── Clock in ──────────────────────────────────────────────────────────────
    def clock_in(self, *, user_id, shift_id=None, notes=None,
                latitude=None, longitude=None, pin=None) -> TimeEntry:

        if self._get_active(user_id):
            raise ValueError("You are already clocked in. Clock out first.")

        company = self._get_company(user_id)
        method  = company.clock_in_method if company else "gps"

        if method == "gps":
            if latitude is None or longitude is None:
                raise ValueError("Location required to clock in.")
            if company:
                location = self._get_location(user_id, shift_id)
                if location and location.loc_lat is not None and location.loc_lng is not None:
                    if not self._within_radius(
                        latitude, longitude,
                        location.loc_lat, location.loc_lng,
                        company.gps_radius_meters,
                    ):
                        raise ValueError(
                            f"You must be within {company.gps_radius_meters}m of your "
                            f"location to clock in."
                        )
                # If location has no GPS coords configured, GPS check passes gracefully

        elif method == "qr_pin":
            if not pin:
                raise ValueError("PIN is required to clock in.")
            if not company or not self._verify_pin(pin, company):
                raise ValueError("Invalid or expired PIN.")

        elif method == "manager_only":
            raise ValueError("Clock-in is managed by your manager.")

        # ✅ Validate shift time window
        if shift_id:
            assignment = ShiftAssignment.query.filter_by(
                shift_id=shift_id, user_id=user_id
            ).first()
            if not assignment:
                raise ValueError("You are not assigned to this shift.")

            from models import Shift
            shift = Shift.query.get(shift_id)
            if shift:
                now         = datetime.now(timezone.utc)
                shift_start = shift.start_time
                if shift_start.tzinfo is None:
                    shift_start = shift_start.replace(tzinfo=timezone.utc)

                window_open  = shift_start - timedelta(minutes=10)
                window_close = shift_start + timedelta(minutes=10)

                if now < window_open:
                    mins_until = int((window_open - now).total_seconds() / 60)
                    raise ValueError(
                        f"Too early to clock in. You can clock in from "
                        f"{window_open.strftime('%I:%M %p')} "
                        f"(in {mins_until} minutes)."
                    )
                if now > window_close:
                    raise ValueError(
                        "Clock-in window has passed. "
                        "Please contact your manager to clock you in manually."
                    )

        entry = TimeEntry(
            user_id=user_id,
            shift_id=shift_id,
            clock_in=datetime.now(timezone.utc),
            notes=notes,
        )
        db.session.add(entry)
        db.session.commit()
        return entry

    # ── Manager clocks in employee ────────────────────────────────────────────
    def manager_clock_in(
        self,
        *,
        manager_user_id: int,
        target_user_id:  int,
        shift_id:        Optional[int] = None,
        notes:           Optional[str] = None,
    ) -> TimeEntry:
        self._assert_manager(manager_user_id, target_user_id)

        if self._get_active(target_user_id):
            raise ValueError("Employee is already clocked in.")

        if shift_id:
            assignment = ShiftAssignment.query.filter_by(
                shift_id=shift_id, user_id=target_user_id
            ).first()
            if not assignment:
                raise ValueError("Employee is not assigned to this shift.")

        entry = TimeEntry(
            user_id=target_user_id,
            shift_id=shift_id,
            clock_in=datetime.now(timezone.utc),
            notes=notes,
        )
        db.session.add(entry)
        db.session.commit()
        return entry

    # ── Manager clocks out employee ───────────────────────────────────────────
    def manager_clock_out(
        self,
        *,
        manager_user_id: int,
        target_user_id:  int,
    ) -> TimeEntry:
        self._assert_manager(manager_user_id, target_user_id)
        active = self._get_active(target_user_id)
        if not active:
            raise ValueError("Employee is not currently clocked in.")
        return self._do_clock_out(active)

    # ── Start break ───────────────────────────────────────────────────────────
    def start_break(self, *, user_id: int) -> BreakEntry:
        active = self._get_active(user_id)
        if not active:
            raise ValueError("You must be clocked in to take a break.")

        ongoing_break = next(
            (b for b in active.breaks if b.break_end is None), None
        )
        if ongoing_break:
            raise ValueError("You are already on a break.")

        company = self._get_company(user_id)

        if company and company.max_breaks_per_shift is not None:
            completed = [b for b in active.breaks if b.break_end is not None]
            if len(completed) >= company.max_breaks_per_shift:
                raise ValueError(
                    f"Maximum {company.max_breaks_per_shift} break(s) allowed per shift."
                )

        brk = BreakEntry(
            entry_id=active.entry_id,
            break_start=datetime.now(timezone.utc),
        )
        db.session.add(brk)
        db.session.commit()
        return brk

    # ── End break ─────────────────────────────────────────────────────────────
    def end_break(self, *, user_id: int) -> BreakEntry:
        active = self._get_active(user_id)
        if not active:
            raise ValueError("You are not clocked in.")

        ongoing = next(
            (b for b in active.breaks if b.break_end is None), None
        )
        if not ongoing:
            raise ValueError("You are not currently on a break.")

        now = datetime.now(timezone.utc)
        break_start = ongoing.break_start
        if break_start.tzinfo is None:
            break_start = break_start.replace(tzinfo=timezone.utc)

        duration_mins = int((now - break_start).total_seconds() / 60)
        ongoing.break_end        = now
        ongoing.duration_minutes = duration_mins
        db.session.commit()
        return ongoing

    # ── Clock out ─────────────────────────────────────────────────────────────
    def clock_out(self, *, user_id: int, notes: Optional[str] = None) -> TimeEntry:
        active = self._get_active(user_id)
        if not active:
            raise ValueError("You are not currently clocked in.")

        ongoing = next((b for b in active.breaks if b.break_end is None), None)
        if ongoing:
            now = datetime.now(timezone.utc)
            break_start = ongoing.break_start
            if break_start.tzinfo is None:
                break_start = break_start.replace(tzinfo=timezone.utc)
            ongoing.break_end        = now
            ongoing.duration_minutes = int((now - break_start).total_seconds() / 60)

        if active.shift_id:
            from models import Shift
            shift = Shift.query.get(active.shift_id)
            if shift:
                now       = datetime.now(timezone.utc)
                shift_end = shift.end_time
                if shift_end.tzinfo is None:
                    shift_end = shift_end.replace(tzinfo=timezone.utc)

                window_open  = shift_end - timedelta(minutes=10)
                window_close = shift_end + timedelta(minutes=10)

                if now < window_open:
                    mins_left = int((window_open - now).total_seconds() / 60)
                    raise ValueError(
                        f"Too early to clock out. Your shift ends at "
                        f"{shift_end.strftime('%I:%M %p')} "
                        f"({mins_left} minutes remaining)."
                    )
                if now > window_close:
                    raise ValueError(
                        "Clock-out window has passed. "
                        "Please contact your manager to clock you out manually."
                    )

        if notes:
            active.notes = notes

        return self._do_clock_out(active)

    # ── Get active entry ──────────────────────────────────────────────────────
    def get_active(self, user_id: int) -> Optional[TimeEntry]:
        return self._get_active(user_id)

    # ── Get history ───────────────────────────────────────────────────────────
    def get_history(self, user_id: int, limit: int = 30) -> List[TimeEntry]:
        return (
            TimeEntry.query
            .filter_by(user_id=user_id)
            .filter(TimeEntry.clock_out.isnot(None))
            .order_by(TimeEntry.clock_in.desc())
            .limit(limit)
            .all()
        )

    # ── Weekly summary ────────────────────────────────────────────────────────
    def get_weekly_summary(self, user_id: int) -> Dict[str, Any]:
        now    = datetime.now(timezone.utc)
        monday = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        entries = TimeEntry.query.filter(
            TimeEntry.user_id  == user_id,
            TimeEntry.clock_in >= monday,
            TimeEntry.clock_out.isnot(None),
        ).all()

        total_minutes  = sum(e.total_minutes or 0 for e in entries)
        total_breaks   = sum(
            sum(b.duration_minutes or 0 for b in e.breaks)
            for e in entries
        )
        return {
            "week_start":    monday.date().isoformat(),
            "total_entries": len(entries),
            "total_minutes": total_minutes,
            "total_hours":   round(total_minutes / 60, 2),
            "break_minutes": total_breaks,
        }

    # ── Get today's shift ─────────────────────────────────────────────────────
    def get_today_shift(self, user_id: int) -> Optional[Dict]:
        from models import Shift
        now   = datetime.now(timezone.utc)
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end   = start + timedelta(days=1)

        shift = (
            Shift.query
            .join(ShiftAssignment, ShiftAssignment.shift_id == Shift.shift_id)
            .filter(
                ShiftAssignment.user_id == user_id,
                Shift.status            == "published",
                Shift.start_time        >= start,
                Shift.start_time        <  end,
            )
            .order_by(Shift.start_time.asc())
            .first()
        )
        if not shift:
            return None
        return {
            "shift_id":   shift.shift_id,
            "role":       shift.role.name if shift.role else "Shift",
            "start_time": shift.start_time.isoformat(),
            "end_time":   shift.end_time.isoformat(),
            "location":   shift.location.loc_name if shift.location else "",
        }

    # ── Get clock settings for user's company ─────────────────────────────────
    def get_clock_settings(self, user_id: int) -> Dict:
        company = self._get_company(user_id)
        if not company:
            return {
                "clock_in_method":      "gps",
                "break_duration_mins":  30,
                "max_breaks_per_shift": None,
                "paid_break":           False,
                "gps_radius_meters":    100,
            }
        return {
            "clock_in_method":      company.clock_in_method,
            "break_duration_mins":  company.break_duration_mins,
            "max_breaks_per_shift": company.max_breaks_per_shift,
            "paid_break":           company.paid_break,
            "gps_radius_meters":    company.gps_radius_meters,
        }

    # ── Update clock settings (owner/manager only) ────────────────────────────
    def update_clock_settings(
        self,
        *,
        manager_user_id:     int,
        clock_in_method:     Optional[str]  = None,
        break_duration_mins: Optional[int]  = None,
        max_breaks:          Optional[int]  = None,
        paid_break:          Optional[bool] = None,
        gps_radius_meters:   Optional[int]  = None,
    ) -> Company:
        company = self._get_company(manager_user_id)
        if not company:
            raise ValueError("No company found.")

        if clock_in_method and clock_in_method in ("manager_only", "gps", "qr_pin"):
            company.clock_in_method = clock_in_method

        if break_duration_mins is not None and break_duration_mins >= 0:
            company.break_duration_mins = break_duration_mins

        if max_breaks is not None:
            company.max_breaks_per_shift = max_breaks if max_breaks > 0 else None

        if paid_break is not None:
            company.paid_break = paid_break

        if gps_radius_meters and gps_radius_meters in (50, 100, 200, 500):
            company.gps_radius_meters = gps_radius_meters

        db.session.commit()
        return company

    # ── Generate daily PIN ────────────────────────────────────────────────────
    def generate_pin(self, manager_user_id: int) -> str:
        company = self._get_company(manager_user_id)
        if not company:
            raise ValueError("No company found.")
        pin = f"{secrets.randbelow(9000) + 1000}"
        company.clock_in_pin     = self._hash_pin(pin)
        company.pin_generated_at = datetime.now(timezone.utc)
        db.session.commit()
        return pin

    # ── Serialization ─────────────────────────────────────────────────────────
    @staticmethod
    def serialize(entry: TimeEntry) -> dict:
        clock_in = entry.clock_in
        if clock_in and clock_in.tzinfo is None:
            clock_in = clock_in.replace(tzinfo=timezone.utc)

        clock_out = entry.clock_out
        if clock_out and clock_out.tzinfo is None:
            clock_out = clock_out.replace(tzinfo=timezone.utc)

        live_minutes = None
        if clock_in and not clock_out:
            live_minutes = int((datetime.now(timezone.utc) - clock_in).total_seconds() / 60)

        ongoing_break = next(
            (b for b in entry.breaks if b.break_end is None), None
        )

        breaks = [
            {
                "break_id":         b.break_id,
                "break_start":      b.break_start.isoformat() if b.break_start else None,
                "break_end":        b.break_end.isoformat()   if b.break_end   else None,
                "duration_minutes": b.duration_minutes,
                "is_active":        b.break_end is None,
            }
            for b in entry.breaks
        ]

        return {
            "entry_id":       entry.entry_id,
            "user_id":        entry.user_id,
            "shift_id":       entry.shift_id,
            "clock_in":       clock_in.isoformat()  if clock_in  else None,
            "clock_out":      clock_out.isoformat() if clock_out else None,
            "total_minutes":  entry.total_minutes,
            "live_minutes":   live_minutes,
            "notes":          entry.notes,
            "is_active":      entry.clock_out is None,
            "is_on_break":    ongoing_break is not None,
            "breaks":         breaks,
            "break_count":    len(breaks),
        }

    # ── Private helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _get_active(user_id: int) -> Optional[TimeEntry]:
        return TimeEntry.query.filter_by(
            user_id=user_id, clock_out=None
        ).first()

    @staticmethod
    def _get_company(user_id: int) -> Optional[Company]:
        emp = Employment.query.filter_by(
            user_id=user_id, status="active"
        ).first()
        return emp.company if emp else None

    @staticmethod
    def _assert_manager(manager_user_id: int, target_user_id: int) -> None:
        mgr_emp = Employment.query.filter_by(
            user_id=manager_user_id, status="active"
        ).first()
        if not mgr_emp or (mgr_emp.role.name if mgr_emp.role else "").lower() \
                not in ("owner", "manager", "supervisor"):
            raise PermissionError("Manager access required.")

        tgt_emp = Employment.query.filter_by(
            user_id=target_user_id,
            comp_id=mgr_emp.comp_id,
            status="active",
        ).first()
        if not tgt_emp:
            raise ValueError("Employee not found in your company.")

    @staticmethod
    def _get_location(user_id: int, shift_id: Optional[int] = None):
        """Return the Location for a shift, or fall back to the user's employment location."""
        from models import Location
        if shift_id:
            shift = Shift.query.get(shift_id)
            if shift and shift.location_id:
                return Location.query.get(shift.location_id)
        emp = Employment.query.filter_by(user_id=user_id, status="active").first()
        if emp and emp.location_id:
            return Location.query.get(emp.location_id)
        return None

    @staticmethod
    def _within_radius(
        user_lat: float,
        user_lng: float,
        loc_lat: float,
        loc_lng: float,
        radius_m: int,
    ) -> bool:
        """
        Haversine distance check.
        Returns True if the user is within radius_m metres of loc_lat/loc_lng.
        """
        import math
        R = 6_371_000  # Earth radius in metres
        phi1 = math.radians(user_lat)
        phi2 = math.radians(loc_lat)
        dphi = math.radians(loc_lat - user_lat)
        dlam = math.radians(loc_lng - user_lng)
        a = (math.sin(dphi / 2) ** 2
             + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2)
        distance = 2 * R * math.asin(math.sqrt(a))
        return distance <= radius_m

    @staticmethod
    def _hash_pin(pin: str) -> str:
        return hashlib.sha256(pin.encode()).hexdigest()

    @staticmethod
    def _verify_pin(pin: str, company: Company) -> bool:
        if not company.clock_in_pin or not company.pin_generated_at:
            return False
        generated = company.pin_generated_at
        if generated.tzinfo is None:
            generated = generated.replace(tzinfo=timezone.utc)
        if (datetime.now(timezone.utc) - generated).total_seconds() > 86400:
            return False
        hashed = hashlib.sha256(pin.encode()).hexdigest()
        return hashed == company.clock_in_pin

    @staticmethod
    def _do_clock_out(active: TimeEntry) -> TimeEntry:
        now      = datetime.now(timezone.utc)
        clock_in = active.clock_in
        if clock_in.tzinfo is None:
            clock_in = clock_in.replace(tzinfo=timezone.utc)

        total_mins = int((now - clock_in).total_seconds() / 60)

        emp     = Employment.query.filter_by(user_id=active.user_id, status="active").first()
        company = emp.company if emp else None
        paid    = company.paid_break if company else False

        if not paid:
            break_mins = sum(b.duration_minutes or 0 for b in active.breaks)
            total_mins = max(total_mins - break_mins, 0)

        active.clock_out     = now
        active.total_minutes = total_mins
        db.session.commit()
        return active