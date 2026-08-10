# workers/tasks.py
from extensions import celery


@celery.task(bind=True, max_retries=3)
def generate_ai_schedule_task(self, location_id, week_start, manager_user_id):
    try:
        from datetime import datetime
        from services.ai_service import AIService
        from services.shift_service import ShiftService
        from services.notification_service import NotificationService
        from utils.socket_events import emit_ai_schedule_ready

        ai_svc    = AIService()
        shift_svc = ShiftService()
        notif_svc = NotificationService()

        shifts_data = ai_svc.generate_schedule(
            location_id=location_id,
            week_start=week_start,
            manager_user_id=manager_user_id,
        )

        created = []
        for s in shifts_data:
            try:
                shift = shift_svc.create_shift(
                    caller_user_id=manager_user_id,
                    location_id=location_id,
                    start_time=datetime.fromisoformat(s["start_time"]),
                    end_time=datetime.fromisoformat(s["end_time"]),
                    break_minutes=s.get("break_minutes", 0),
                    notes=s.get("notes", ""),
                    created_by_ai=True,
                )
                if s.get("user_id"):
                    try:
                        shift_svc.assign_user(
                            shift_id=shift.shift_id,
                            user_id=s["user_id"],
                            caller_user_id=manager_user_id,
                        )
                    except Exception:
                        pass
                created.append(shift.shift_id)
            except Exception:
                continue

        count = len(created)
        emit_ai_schedule_ready(location_id, manager_user_id, week_start, count)
        notif_svc.create(
            user_id=manager_user_id,
            notif_type="ai_schedule_ready",
            title="AI Schedule Ready",
            body=f"AI generated {count} draft shifts for {week_start}. Tap to review.",
            data={"week_start": week_start, "location_id": location_id, "shift_count": count},
        )
        return {"status": "done", "shift_count": count, "shift_ids": created}

    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@celery.task(bind=True, max_retries=3)
def run_staffing_prediction_task(self, location_id, target_week, manager_user_id):
    try:
        from services.ai_service import AIService
        from services.notification_service import NotificationService
        from utils.socket_events import emit_ai_prediction

        ai_svc    = AIService()
        notif_svc = NotificationService()

        prediction = ai_svc.predict_staffing(
            location_id=location_id, target_week=target_week
        )
        emit_ai_prediction(location_id, prediction)
        notif_svc.create(
            user_id=manager_user_id,
            notif_type="ai_prediction_ready",
            title="Staffing Prediction Ready",
            body=f"AI staffing forecast for {target_week} is available.",
            data={"prediction": prediction},
        )
        return prediction
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)