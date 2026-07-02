# controllers/time_off_controller.py
from datetime import date
from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity
from services.time_off_service import TimeOffService
from models import Employment

svc = TimeOffService()


class TimeOffController:

    def create(self):
        try:
            user_id = int(get_jwt_identity())
            data    = request.get_json(silent=True) or {}

            start_str = data.get("start_date", "")
            end_str   = data.get("end_date", "")
            if not start_str or not end_str:
                return jsonify({"error": "start_date and end_date are required (YYYY-MM-DD)"}), 400

            start = date.fromisoformat(start_str)
            end   = date.fromisoformat(end_str)

            req = svc.request(
                user_id=user_id,
                start_date=start,
                end_date=end,
                request_type=data.get("request_type", "vacation"),
                reason=(data.get("reason") or "").strip() or None,
            )
            return jsonify({"message": "Time off request submitted", "request": svc.serialize(req)}), 201
        except (ValueError, PermissionError) as e:
            return jsonify({"error": str(e)}), 400
        except Exception:
            return jsonify({"error": "Something went wrong"}), 500

    def my_requests(self):
        try:
            user_id  = int(get_jwt_identity())
            requests = svc.get_mine(user_id)
            return jsonify({"requests": [svc.serialize(r) for r in requests]}), 200
        except Exception:
            return jsonify({"error": "Something went wrong"}), 500

    def cancel(self, request_id: int):
        try:
            user_id = int(get_jwt_identity())
            req = svc.cancel(request_id=request_id, user_id=user_id)
            return jsonify({"message": "Cancelled", "request": svc.serialize(req)}), 200
        except (ValueError, PermissionError) as e:
            return jsonify({"error": str(e)}), 400
        except Exception:
            return jsonify({"error": "Something went wrong"}), 500

    def pending(self):
        try:
            manager_id = int(get_jwt_identity())
            emp = Employment.query.filter_by(user_id=manager_id, status="active").first()
            if not emp:
                return jsonify({"error": "Not found"}), 404
            requests = svc.get_pending_for_manager(emp.comp_id)
            return jsonify({"requests": [svc.serialize(r) for r in requests]}), 200
        except Exception:
            return jsonify({"error": "Something went wrong"}), 500

    def decide(self, request_id: int):
        try:
            manager_id    = int(get_jwt_identity())
            data          = request.get_json(silent=True) or {}
            approve       = bool(data.get("approve", False))
            manager_notes = (data.get("manager_notes") or "").strip() or None
            req = svc.decide(
                request_id=request_id,
                manager_id=manager_id,
                approve=approve,
                manager_notes=manager_notes,
            )
            return jsonify({"message": "Decision recorded", "request": svc.serialize(req)}), 200
        except (ValueError, PermissionError) as e:
            return jsonify({"error": str(e)}), 400
        except Exception:
            return jsonify({"error": "Something went wrong"}), 500