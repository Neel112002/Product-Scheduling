# controllers/shift_controller.py
from datetime import datetime
from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity
from services.shift_service import ShiftService

svc = ShiftService()


class ShiftController:

    def list_shifts(self):
        caller_id   = int(get_jwt_identity())
        location_id = request.args.get("location_id", type=int)
        week_start  = request.args.get("week_start")
        status      = request.args.get("status")
        if not location_id:
            return jsonify({"error": "location_id is required"}), 400
        try:
            shifts = svc.get_shifts(caller_user_id=caller_id,
                                    location_id=location_id,
                                    week_start=week_start, status=status)
            return jsonify({"shifts": [svc.serialize(s) for s in shifts]}), 200
        except PermissionError as e:
            return jsonify({"error": str(e)}), 403

    def my_shifts(self):
        caller_id  = int(get_jwt_identity())
        week_start = request.args.get("week_start")
        shifts     = svc.get_my_shifts(caller_id, week_start)
        return jsonify({"shifts": [svc.serialize(s) for s in shifts]}), 200

    def get_shift(self, shift_id):
        caller_id = int(get_jwt_identity())
        try:
            shift = svc.get_shift(shift_id, caller_id)
            return jsonify({"shift": svc.serialize(shift)}), 200
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        except PermissionError as e:
            return jsonify({"error": str(e)}), 403

    def create_shift(self):
        caller_id = int(get_jwt_identity())
        data      = request.get_json(silent=True) or {}
        location_id = data.get("location_id")
        if not location_id:
            return jsonify({"error": "location_id is required"}), 400
        try:
            start_time = datetime.fromisoformat(data["start_time"])
            end_time   = datetime.fromisoformat(data["end_time"])
        except (KeyError, ValueError):
            return jsonify({"error": "start_time and end_time required (ISO 8601)"}), 400
        try:
            shift = svc.create_shift(
                caller_user_id=caller_id, location_id=location_id,
                start_time=start_time, end_time=end_time,
                role_id=data.get("role_id"),
                break_minutes=data.get("break_minutes", 0),
                notes=data.get("notes"),
            )
            return jsonify({"shift": svc.serialize(shift)}), 201
        except PermissionError as e:
            return jsonify({"error": str(e)}), 403
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    def update_shift(self, shift_id):
        caller_id = int(get_jwt_identity())
        data      = request.get_json(silent=True) or {}
        kwargs    = {"shift_id": shift_id, "caller_user_id": caller_id}
        for field in ("role_id", "break_minutes", "notes"):
            if field in data:
                kwargs[field] = data[field]
        if "start_time" in data:
            try:
                kwargs["start_time"] = datetime.fromisoformat(data["start_time"])
            except ValueError:
                return jsonify({"error": "Invalid start_time"}), 400
        if "end_time" in data:
            try:
                kwargs["end_time"] = datetime.fromisoformat(data["end_time"])
            except ValueError:
                return jsonify({"error": "Invalid end_time"}), 400
        try:
            shift = svc.update_shift(**kwargs)
            return jsonify({"shift": svc.serialize(shift)}), 200
        except PermissionError as e:
            return jsonify({"error": str(e)}), 403
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    def cancel_shift(self, shift_id):
        caller_id = int(get_jwt_identity())
        try:
            shift = svc.cancel_shift(shift_id=shift_id, caller_user_id=caller_id)
            return jsonify({"shift": svc.serialize(shift)}), 200
        except PermissionError as e:
            return jsonify({"error": str(e)}), 403
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    # ── Bulk week-wise create ─────────────────────────────────────────────────
    def bulk_create_week(self):
        caller_id   = int(get_jwt_identity())
        data        = request.get_json(silent=True) or {}
        location_id = data.get("location_id")
        week_start  = data.get("week_start")
        rows        = data.get("rows", [])
        if not location_id or not week_start:
            return jsonify({"error": "location_id and week_start are required"}), 400
        if not isinstance(rows, list) or not rows:
            return jsonify({"error": "rows must be a non-empty array"}), 400
        try:
            result = svc.bulk_create_week(
                caller_user_id=caller_id,
                location_id=location_id,
                week_start=week_start,
                rows=rows,
            )
            return jsonify(result), 201
        except PermissionError as e:
            return jsonify({"error": str(e)}), 403
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception:
            import traceback; traceback.print_exc()
            return jsonify({"error": "Something went wrong"}), 500

    def roles_with_staff(self):
        caller_id   = int(get_jwt_identity())
        location_id = request.args.get("location_id", type=int)
        if not location_id:
            return jsonify({"error": "location_id is required"}), 400
        try:
            roles = svc.roles_with_staff(caller_user_id=caller_id, location_id=location_id)
            return jsonify({"roles": roles}), 200
        except PermissionError as e:
            return jsonify({"error": str(e)}), 403
        except Exception:
            import traceback; traceback.print_exc()
            return jsonify({"error": "Something went wrong"}), 500

    def assign_user(self, shift_id):
        caller_id = int(get_jwt_identity())
        data      = request.get_json(silent=True) or {}
        user_id   = data.get("user_id")
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
        try:
            svc.assign_user(shift_id=shift_id, user_id=user_id, caller_user_id=caller_id)
            return jsonify({"message": "User assigned successfully"}), 200
        except PermissionError as e:
            return jsonify({"error": str(e)}), 403
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    def unassign_user(self, shift_id):
        caller_id = int(get_jwt_identity())
        data      = request.get_json(silent=True) or {}
        user_id   = data.get("user_id")
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
        try:
            svc.unassign_user(shift_id=shift_id, user_id=user_id, caller_user_id=caller_id)
            return jsonify({"message": "User unassigned"}), 200
        except (PermissionError, ValueError) as e:
            return jsonify({"error": str(e)}), 400

    def publish_week(self):
        caller_id = int(get_jwt_identity())
        data      = request.get_json(silent=True) or {}
        location_id = data.get("location_id")
        week_start  = data.get("week_start")
        if not location_id or not week_start:
            return jsonify({"error": "location_id and week_start are required"}), 400
        try:
            count = svc.publish_week(caller_user_id=caller_id,
                                     location_id=location_id, week_start=week_start)
            return jsonify({"message": f"Published {count} shifts", "published_count": count}), 200
        except PermissionError as e:
            return jsonify({"error": str(e)}), 403
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    def labor_cost(self):
        caller_id   = int(get_jwt_identity())
        location_id = request.args.get("location_id", type=int)
        week_start  = request.args.get("week_start")
        hourly_rate = request.args.get("hourly_rate", default=15.0, type=float)
        if not location_id or not week_start:
            return jsonify({"error": "location_id and week_start are required"}), 400
        result = svc.get_labor_cost(location_id=location_id,
                                    week_start=week_start, hourly_rate=hourly_rate)
        return jsonify(result), 200