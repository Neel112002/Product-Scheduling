# controllers/drop_controller.py
from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity
from services.drop_service import DropService

svc = DropService()


class DropController:

    def request_drop(self):
        try:
            user_id  = int(get_jwt_identity())
            data     = request.get_json(silent=True) or {}
            shift_id = data.get("shift_id")
            reason   = (data.get("reason") or "").strip() or None
            if not shift_id:
                return jsonify({"error": "shift_id is required"}), 400
            drop = svc.request_drop(user_id=user_id, shift_id=shift_id, reason=reason)
            return jsonify({"message": "Drop request submitted", "drop": svc.serialize(drop)}), 201
        except (ValueError, PermissionError) as e:
            return jsonify({"error": str(e)}), 400
        except Exception:
            return jsonify({"error": "Something went wrong"}), 500

    def cancel_drop(self, drop_id: int):
        try:
            user_id = int(get_jwt_identity())
            drop = svc.cancel_drop(drop_id=drop_id, user_id=user_id)
            return jsonify({"message": "Drop cancelled", "drop": svc.serialize(drop)}), 200
        except (ValueError, PermissionError) as e:
            return jsonify({"error": str(e)}), 400
        except Exception:
            return jsonify({"error": "Something went wrong"}), 500

    def my_drops(self):
        try:
            user_id = int(get_jwt_identity())
            drops   = svc.get_my_drops(user_id)
            return jsonify({"drops": [svc.serialize(d) for d in drops]}), 200
        except Exception:
            return jsonify({"error": "Something went wrong"}), 500

    def pending_drops(self):
        try:
            location_id = request.args.get("location_id", type=int)
            if not location_id:
                return jsonify({"error": "location_id required"}), 400
            drops = svc.get_pending_for_manager(location_id)
            return jsonify({"drops": [svc.serialize(d) for d in drops]}), 200
        except Exception:
            return jsonify({"error": "Something went wrong"}), 500

    def decide_drop(self, drop_id: int):
        try:
            manager_id = int(get_jwt_identity())
            data       = request.get_json(silent=True) or {}
            approve    = bool(data.get("approve", False))
            drop = svc.manager_decide(
                drop_id=drop_id, manager_user_id=manager_id, approve=approve
            )
            return jsonify({"message": "Decision recorded", "drop": svc.serialize(drop)}), 200
        except (ValueError, PermissionError) as e:
            return jsonify({"error": str(e)}), 400
        except Exception:
            return jsonify({"error": "Something went wrong"}), 500