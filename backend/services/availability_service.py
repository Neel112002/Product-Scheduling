# services/availability_service.py
from datetime import time
from typing import Optional, Dict, Any, List, Literal
from sqlalchemy.exc import IntegrityError
from extensions import db
from models import Availability, Employment

DayName = Literal["mon","tue","wed","thu","fri","sat","sun"]
_ALLOWED_DAYS = ["mon","tue","wed","thu","fri","sat","sun"]

def _parse_hhmm(value: str) -> time:
    parts = (value or "").strip().split(":")
    if len(parts) != 2:
        raise ValueError("time must be HH:MM")
    hh, mm = int(parts[0]), int(parts[1])
    if not (0 <= hh <= 23 and 0 <= mm <= 59):
        raise ValueError("time out of range")
    return time(hour=hh, minute=mm)

class AvailabilityService:
    """
    Availability is scoped to Employment (emp_id).
      - emp_id must exist
      - start_time < end_time
      - day_of_week in mon..sun
      - optional authorization: caller must be the same user as employment.user_id,
        or have a privileged position (owner/manager/admin) in same company.
      - overlap check per (emp_id, day_of_week)
    """

    def __init__(self, overlap_check: bool = True) -> None:
        self.overlap_check = overlap_check

    def _assert_day(self, day: str) -> str:
        d = (day or "").strip().lower()
        if d not in _ALLOWED_DAYS:
            raise ValueError(f"day_of_week must be one of: {', '.join(_ALLOWED_DAYS)}")
        return d

    def _get_employment(self, emp_id: int) -> Employment:
        emp = Employment.query.get(emp_id)
        if not emp:
            raise ValueError("employment (emp_id) not found")
        return emp

    def _authorize(self, caller_user_id: int, emp: Employment) -> None:
        if caller_user_id == emp.user_id:
            # employee creating their own availability
            if emp.status != "active":
                raise ValueError("employment is not active")
            return
        # otherwise require privileged role in same company
        mgr = Employment.query.filter_by(user_id=caller_user_id, comp_id=emp.comp_id, status="active").first()
        role = (mgr.position or "").lower() if mgr else ""
        if role not in ("owner", "manager", "admin"):
            raise ValueError("not authorized to create availability for this employee")

    def _assert_no_overlap(self, emp_id: int, day: str, start_t: time, end_t: time) -> None:
        exists = (
            db.session.query(Availability)
            .filter(
                Availability.emp_id == emp_id,
                Availability.day_of_week == day,
                Availability.start_time < end_t,
                Availability.end_time > start_t,
            )
            .first()
        )
        if exists:
            raise ValueError("availability overlaps with an existing window")

    def create_availability(
        self,
        *,
        caller_user_id: int,
        emp_id: int,
        day_of_week: str,
        start_time_str: str,
        end_time_str: str,
    ) -> Dict[str, Any]:
        # validate inputs
        emp = self._get_employment(emp_id)
        self._authorize(caller_user_id, emp)
        day = self._assert_day(day_of_week)
        start_t = _parse_hhmm(start_time_str)
        end_t = _parse_hhmm(end_time_str)
        if not (start_t < end_t):
            raise ValueError("start_time must be earlier than end_time")

        # overlap rules
        if self.overlap_check:
            self._assert_no_overlap(emp.emp_id, day, start_t, end_t)

        # persist
        av = Availability(
            emp_id=emp.emp_id,
            day_of_week=day,
            start_time=start_t,
            end_time=end_t,
        )
        db.session.add(av)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise ValueError("failed to create availability")
        return {
            "availability_id": int(av.availability_id),
            "emp_id": int(av.emp_id),
            "day_of_week": av.day_of_week,
            "start_time": av.start_time.strftime("%H:%M"),
            "end_time": av.end_time.strftime("%H:%M"),
        }
