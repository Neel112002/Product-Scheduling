# controllers/availability_controller.py
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.availability_service import AvailabilityService

class AvailabilityController:
    def __init__(self) -> None:
        self.svc = AvailabilityService(overlap_check=True)

    @jwt_required()
    def create(self):
        """
        Accepts:
        1) Single object:
           { "emp_id": 10, "day_of_week": "mon", "start_time": "08:30", "end_time": "16:30" }

        2) Raw array:
           [
             { "emp_id": 10, "day_of_week": "mon", "start_time": "08:30", "end_time": "16:30" },
             ...
           ]

        3) Wrapped:
           { "availabilities": [ { ... }, { ... } ] }
        """
        caller_id = int(get_jwt_identity())
        payload = request.get_json(silent=True)

        if payload is None:
            return jsonify({"error": "JSON body required"}), 400

        # normalize shapes
        if isinstance(payload, dict) and "availabilities" in payload and isinstance(payload["availabilities"], list):
            items = payload["availabilities"]
        elif isinstance(payload, list):
            items = payload
        elif isinstance(payload, dict):
            items = [payload]
        else:
            return jsonify({"error": "Body must be an object, an array, or {\"availabilities\": [...] }"}), 400

        # helper for one item
        def _create_one(item: dict):
            try:
                emp_id = int(item["emp_id"])
                day = item["day_of_week"]
                start_time = item["start_time"]
                end_time = item["end_time"]
            except (KeyError, ValueError, TypeError):
                raise ValueError("Each item must include emp_id, day_of_week, start_time, end_time")

            return self.svc.create_availability(
                caller_user_id=caller_id,
                emp_id=emp_id,
                day_of_week=day,
                start_time_str=start_time,
                end_time_str=end_time,
            )

        # process
        results, errors = [], []
        for idx, it in enumerate(items):
            if not isinstance(it, dict):
                errors.append({"index": idx, "error": "Each element must be an object"})
                continue
            try:
                results.append(_create_one(it))
            except ValueError as e:
                errors.append({"index": idx, "error": str(e)})

        status = 201 if results and not errors else 207 if results and errors else 400
        return jsonify({"created": results, "errors": errors}), status
