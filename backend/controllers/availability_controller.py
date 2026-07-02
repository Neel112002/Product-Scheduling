# controllers/availability_controller.py
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.availability_service import AvailabilityService
from models import Availability, Employment

class AvailabilityController:
    def __init__(self) -> None:
        self.svc = AvailabilityService(overlap_check=True)

    @jwt_required()
    def create(self):
        caller_id = int(get_jwt_identity())
        payload   = request.get_json(silent=True)

        if payload is None:
            return jsonify({"error": "JSON body required"}), 400

        if isinstance(payload, dict) and "availabilities" in payload and isinstance(payload["availabilities"], list):
            items = payload["availabilities"]
        elif isinstance(payload, list):
            items = payload
        elif isinstance(payload, dict):
            items = [payload]
        else:
            return jsonify({"error": "Body must be an object, an array, or {\"availabilities\": [...]}"}), 400

        def _create_one(item: dict):
            try:
                emp_id     = int(item["emp_id"])
                day        = item["day_of_week"]
                start_time = item["start_time"]
                end_time   = item["end_time"]
            except (KeyError, ValueError, TypeError):
                raise ValueError("Each item must include emp_id, day_of_week, start_time, end_time")
            return self.svc.create_availability(
                caller_user_id=caller_id,
                emp_id=emp_id,
                day_of_week=day,
                start_time_str=start_time,
                end_time_str=end_time,
            )

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

    @jwt_required()
    def get_mine(self):
        try:
            user_id = int(get_jwt_identity())
            emp = Employment.query.filter_by(user_id=user_id, status="active").first()
            if not emp:
                return jsonify({"availabilities": []}), 200

            avails = Availability.query.filter_by(emp_id=emp.emp_id).all()
            return jsonify({
                "emp_id": emp.emp_id,
                "availabilities": [
                    {
                        "availability_id": a.availability_id,
                        "emp_id":          a.emp_id,
                        "day_of_week":     a.day_of_week,
                        "start_time":      a.start_time.strftime("%H:%M"),
                        "end_time":        a.end_time.strftime("%H:%M"),
                    }
                    for a in avails
                ]
            }), 200
        except Exception:
            return jsonify({"error": "Something went wrong"}), 500

    @jwt_required()
    def delete(self, availability_id: int):
        try:
            user_id = int(get_jwt_identity())
            emp     = Employment.query.filter_by(user_id=user_id, status="active").first()
            if not emp:
                return jsonify({"error": "Not found"}), 404

            avail = Availability.query.filter_by(
                availability_id=availability_id,
                emp_id=emp.emp_id,
            ).first()
            if not avail:
                return jsonify({"error": "Availability not found"}), 404

            from extensions import db
            db.session.delete(avail)
            db.session.commit()
            return jsonify({"message": "Deleted"}), 200
        except Exception:
            return jsonify({"error": "Something went wrong"}), 500