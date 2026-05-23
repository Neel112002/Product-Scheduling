# controllers/time_entry_controller.py
from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity
from services.time_entry_service import TimeEntryService

svc = TimeEntryService()


class TimeEntryController:

    def clock_in(self):
        user_id = int(get_jwt_identity())
        data    = request.get_json(silent=True) or {}
        try:
            entry = svc.clock_in(
                user_id=user_id,
                shift_id=data.get("shift_id"),
                notes=data.get("notes"),
                latitude=data.get("latitude"),
                longitude=data.get("longitude"),
                pin=data.get("pin"),
            )
            return jsonify({"message": "Clocked in", "entry": svc.serialize(entry)}), 201
        except PermissionError as e:
            return jsonify({"error": str(e)}), 403
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    def manager_clock_in(self):
        manager_id     = int(get_jwt_identity())
        data           = request.get_json(silent=True) or {}
        target_user_id = data.get("user_id")
        if not target_user_id:
            return jsonify({"error": "user_id is required"}), 400
        try:
            entry = svc.manager_clock_in(
                manager_user_id=manager_id,
                target_user_id=int(target_user_id),
                shift_id=data.get("shift_id"),
                notes=data.get("notes"),
            )
            return jsonify({"message": "Employee clocked in", "entry": svc.serialize(entry)}), 201
        except (PermissionError, ValueError) as e:
            return jsonify({"error": str(e)}), 400

    def manager_clock_out(self):
        manager_id     = int(get_jwt_identity())
        data           = request.get_json(silent=True) or {}
        target_user_id = data.get("user_id")
        if not target_user_id:
            return jsonify({"error": "user_id is required"}), 400
        try:
            entry = svc.manager_clock_out(
                manager_user_id=manager_id,
                target_user_id=int(target_user_id),
            )
            return jsonify({"message": "Employee clocked out", "entry": svc.serialize(entry)}), 200
        except (PermissionError, ValueError) as e:
            return jsonify({"error": str(e)}), 400

    def start_break(self):
        user_id = int(get_jwt_identity())
        try:
            brk = svc.start_break(user_id=user_id)
            return jsonify({
                "message":     "Break started",
                "break_start": brk.break_start.isoformat(),
            }), 200
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    def end_break(self):
        user_id = int(get_jwt_identity())
        try:
            brk = svc.end_break(user_id=user_id)
            return jsonify({
                "message":          "Break ended",
                "duration_minutes": brk.duration_minutes,
            }), 200
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    def clock_out(self):
        user_id = int(get_jwt_identity())
        data    = request.get_json(silent=True) or {}
        try:
            entry    = svc.clock_out(user_id=user_id, notes=data.get("notes"))
            total_h  = round((entry.total_minutes or 0) / 60, 2)
            return jsonify({
                "message":     f"Clocked out. Total: {total_h}h",
                "entry":       svc.serialize(entry),
                "total_hours": total_h,
            }), 200
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    def get_active(self):
        user_id  = int(get_jwt_identity())
        active   = svc.get_active(user_id)
        settings = svc.get_clock_settings(user_id)
        today    = svc.get_today_shift(user_id)
        return jsonify({
            "active":        svc.serialize(active) if active else None,
            "is_clocked_in": active is not None,
            "settings":      settings,
            "today_shift":   today,
        }), 200

    def get_history(self):
        user_id = int(get_jwt_identity())
        limit   = request.args.get("limit", default=30, type=int)
        entries = svc.get_history(user_id, limit=limit)
        summary = svc.get_weekly_summary(user_id)
        return jsonify({
            "entries":        [svc.serialize(e) for e in entries],
            "weekly_summary": summary,
        }), 200

    def get_settings(self):
        user_id  = int(get_jwt_identity())
        settings = svc.get_clock_settings(user_id)
        return jsonify({"settings": settings}), 200

    def update_settings(self):
        manager_id = int(get_jwt_identity())
        data       = request.get_json(silent=True) or {}
        try:
            company = svc.update_clock_settings(
                manager_user_id=manager_id,
                clock_in_method=data.get("clock_in_method"),
                break_duration_mins=data.get("break_duration_mins"),
                max_breaks=data.get("max_breaks_per_shift"),
                paid_break=data.get("paid_break"),
                gps_radius_meters=data.get("gps_radius_meters"),
            )
            return jsonify({
                "message": "Clock settings updated",
                "settings": svc.get_clock_settings(manager_id),
            }), 200
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    def generate_pin(self):
        manager_id = int(get_jwt_identity())
        try:
            pin = svc.generate_pin(manager_id)
            return jsonify({
                "message": "New PIN generated",
                "pin":     pin,
                "expires": "24 hours",
            }), 200
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        
    def get_team_status(self):
        from datetime import datetime, timezone, timedelta
        from models import Shift, ShiftAssignment, Employment, AppUser

        user_id     = int(get_jwt_identity())
        location_id = request.args.get("location_id", type=int)

        if not location_id:
            return jsonify({"error": "location_id required"}), 400

        now   = datetime.now(timezone.utc)
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end   = start + timedelta(days=1)

        # All active employees at this location
        emps = Employment.query.filter_by(
            location_id=location_id,
            status="active",
        ).all()

        team_status = []

        for emp in emps:
            if not emp.user:
                continue

            user = emp.user

            # ✅ Find today's shift — SKIP if no shift today
            today_shift = (
                Shift.query
                .join(ShiftAssignment, ShiftAssignment.shift_id == Shift.shift_id)
                .filter(
                    ShiftAssignment.user_id == user.user_id,
                    Shift.location_id       == location_id,
                    Shift.status            == "published",
                    Shift.start_time        >= start,
                    Shift.start_time        <  end,
                )
                .first()
            )

            # ✅ Only include employees with a shift today
            if not today_shift:
                continue

            # Find active time entry
            active_entry = TimeEntry.query.filter_by(
                user_id=user.user_id,
                clock_out=None,
            ).first()

            # Determine status
            if active_entry:
                is_on_break = any(b.break_end is None for b in active_entry.breaks)
                status      = "on_break" if is_on_break else "working"
            else:
                shift_start = today_shift.start_time
                if shift_start.tzinfo is None:
                    shift_start = shift_start.replace(tzinfo=timezone.utc)
                status = "late" if now > shift_start + timedelta(minutes=10) else "scheduled"

            name     = user.display_name or user.username
            initials = "".join(p[0] for p in name.strip().split()[:2]).upper()

            team_status.append({
                "user_id":     user.user_id,
                "name":        name,
                "initials":    initials,
                "role":        emp.role.name if emp.role else "Staff",
                "status":      status,
                "shift_start": today_shift.start_time.isoformat() if today_shift else None,
                "shift_end":   today_shift.end_time.isoformat()   if today_shift else None,
                "clocked_in":  active_entry.clock_in.isoformat()  if active_entry else None,
            })

        # Sort: late first, then working, on_break, scheduled
        ORDER = {"late": 0, "working": 1, "on_break": 2, "scheduled": 3}
        team_status.sort(key=lambda x: ORDER.get(x["status"], 4))

        return jsonify({"team": team_status}), 200