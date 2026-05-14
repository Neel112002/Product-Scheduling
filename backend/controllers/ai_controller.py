# controllers/ai_controller.py
from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity
from services.ai_service import AIService
from services.shift_service import ShiftService
from utils.plan_guard import get_company_plan

ai_svc    = AIService()
shift_svc = ShiftService()
_PLANS    = ["free", "advanced", "professional"]


class AIController:

    def chat(self):
        caller_id   = int(get_jwt_identity())
        data        = request.get_json(silent=True) or {}
        message     = (data.get("message") or "").strip()
        location_id = data.get("location_id")
        history     = data.get("history", [])

        if not message:
            return jsonify({"error": "message is required"}), 400
        if not location_id:
            return jsonify({"error": "location_id is required"}), 400

        plan      = get_company_plan(caller_id)
        can_write = _PLANS.index(plan) >= _PLANS.index("advanced")

        try:
            result = ai_svc.chat(user_id=caller_id, location_id=location_id,
                                 message=message, can_write=can_write,
                                 conversation_history=history)
            executed_shifts = []
            if can_write and result.get("action_data"):
                action = result["action_data"]
                if action.get("action") == "create_shifts":
                    from datetime import datetime
                    for s in action.get("shifts", []):
                        try:
                            shift = shift_svc.create_shift(
                                caller_user_id=caller_id,
                                location_id=location_id,
                                start_time=datetime.fromisoformat(s["start_time"]),
                                end_time=datetime.fromisoformat(s["end_time"]),
                                role_id=s.get("role_id"),
                                break_minutes=s.get("break_minutes", 0),
                                notes=s.get("notes"),
                                created_by_ai=True,
                            )
                            if s.get("user_id"):
                                try:
                                    shift_svc.assign_user(shift_id=shift.shift_id,
                                                          user_id=s["user_id"],
                                                          caller_user_id=caller_id)
                                except Exception:
                                    pass
                            executed_shifts.append(shift_svc.serialize(shift))
                        except Exception:
                            continue

            return jsonify({"reply": result["reply"], "plan": plan,
                            "can_write": can_write, "executed_shifts": executed_shifts}), 200
        except Exception as e:
            return jsonify({"error": f"AI error: {str(e)}"}), 500

    def generate_schedule(self):
        caller_id   = int(get_jwt_identity())
        data        = request.get_json(silent=True) or {}
        location_id = data.get("location_id")
        week_start  = data.get("week_start")
        if not location_id or not week_start:
            return jsonify({"error": "location_id and week_start are required"}), 400
        plan = get_company_plan(caller_id)
        if _PLANS.index(plan) < _PLANS.index("advanced"):
            return jsonify({"error": "Plan upgrade required", "required_plan": "advanced"}), 403
        try:
            from workers.tasks import generate_ai_schedule_task
            task = generate_ai_schedule_task.delay(
                location_id=location_id, week_start=week_start, manager_user_id=caller_id
            )
            return jsonify({"message": "AI is generating your schedule. You'll be notified when ready.",
                            "job_id": task.id, "status": "queued"}), 202
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    def job_status(self, job_id):
        try:
            from workers.tasks import generate_ai_schedule_task
            result = generate_ai_schedule_task.AsyncResult(job_id)
            return jsonify({"job_id": job_id, "status": result.status,
                            "result": result.result if result.ready() else None}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    def predict_staffing(self):
        caller_id   = int(get_jwt_identity())
        data        = request.get_json(silent=True) or {}
        location_id = data.get("location_id")
        target_week = data.get("week_start")
        if not location_id or not target_week:
            return jsonify({"error": "location_id and week_start are required"}), 400
        plan = get_company_plan(caller_id)
        if _PLANS.index(plan) < _PLANS.index("advanced"):
            return jsonify({"error": "Plan upgrade required", "required_plan": "advanced"}), 403
        try:
            from workers.tasks import run_staffing_prediction_task
            task = run_staffing_prediction_task.delay(
                location_id=location_id, target_week=target_week, manager_user_id=caller_id
            )
            return jsonify({"message": "Prediction running.", "job_id": task.id, "status": "queued"}), 202
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    def swap_recommendations(self):
        caller_id   = int(get_jwt_identity())
        data        = request.get_json(silent=True) or {}
        swap_id     = data.get("swap_id")
        location_id = data.get("location_id")
        if not swap_id or not location_id:
            return jsonify({"error": "swap_id and location_id are required"}), 400
        plan = get_company_plan(caller_id)
        if _PLANS.index(plan) < _PLANS.index("professional"):
            return jsonify({"error": "Plan upgrade required", "required_plan": "professional"}), 403
        try:
            candidates = ai_svc.recommend_swap_matches(swap_id=swap_id, location_id=location_id)
            return jsonify({"candidates": candidates}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500