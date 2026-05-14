# controllers/swap_controller.py
from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity
from services.swap_service import SwapService

svc = SwapService()


class SwapController:

    def request_swap(self):
        caller_id = int(get_jwt_identity())
        data      = request.get_json(silent=True) or {}
        shift_id  = data.get("shift_id")
        if not shift_id:
            return jsonify({"error": "shift_id is required"}), 400
        try:
            swap = svc.request_swap(requesting_user_id=caller_id,
                                    shift_id=shift_id, reason=data.get("reason"))
            return jsonify({"swap": svc.serialize(swap)}), 201
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    def my_swaps(self):
        caller_id = int(get_jwt_identity())
        return jsonify({"swaps": [svc.serialize(s) for s in svc.get_my_swaps(caller_id)]}), 200

    def pending_swaps(self):
        location_id = request.args.get("location_id", type=int)
        if not location_id:
            return jsonify({"error": "location_id is required"}), 400
        return jsonify({"swaps": [svc.serialize(s) for s in svc.get_pending_for_manager(location_id)]}), 200

    def accept_swap(self, swap_id):
        caller_id = int(get_jwt_identity())
        try:
            swap = svc.accept_swap(receiving_user_id=caller_id, swap_id=swap_id)
            return jsonify({"swap": svc.serialize(swap)}), 200
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    def reject_swap(self, swap_id):
        caller_id = int(get_jwt_identity())
        try:
            swap = svc.reject_swap(swap_id=swap_id, user_id=caller_id)
            return jsonify({"swap": svc.serialize(swap)}), 200
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    def manager_approve(self, swap_id):
        caller_id = int(get_jwt_identity())
        data      = request.get_json(silent=True) or {}
        approve   = data.get("approve")
        if approve is None:
            return jsonify({"error": "approve (true/false) is required"}), 400
        try:
            swap = svc.manager_approve(swap_id=swap_id,
                                       manager_user_id=caller_id, approve=bool(approve))
            return jsonify({"swap": svc.serialize(swap)}), 200
        except PermissionError as e:
            return jsonify({"error": str(e)}), 403
        except ValueError as e:
            return jsonify({"error": str(e)}), 400