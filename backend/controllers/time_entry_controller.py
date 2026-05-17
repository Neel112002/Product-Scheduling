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