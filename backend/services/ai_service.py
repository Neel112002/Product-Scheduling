# services/ai_service.py
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import anthropic
from flask import current_app
from extensions import db
from models import AppUser, Employment, Availability, Shift, ShiftAssignment, Location


class AIService:

    def _client(self):
        return anthropic.Anthropic(api_key=current_app.config.get("ANTHROPIC_API_KEY"))

    def _model(self):
        return current_app.config.get("AI_MODEL", "claude-sonnet-4-6")

    # ── Chat assistant ────────────────────────────────────────────────────────
    def chat(self, *, user_id, location_id, message, can_write=False, conversation_history=None):
        context = self._build_context(location_id)

        if can_write:
            system = f"""You are an AI scheduling assistant with full access to create shifts.
When asked to create shifts, respond with a JSON block like this:
```json
{{
  "action": "create_shifts",
  "shifts": [
    {{
      "start_time": "2024-01-15T09:00:00",
      "end_time": "2024-01-15T17:00:00",
      "user_id": 123,
      "role_id": null,
      "break_minutes": 30,
      "notes": ""
    }}
  ],
  "message": "I've created 3 shifts for next week."
}}
```
For other questions, respond normally without JSON.
Location data: {json.dumps(context, indent=2)}
Today: {datetime.utcnow().strftime('%A, %B %d, %Y')}"""
        else:
            system = f"""You are a helpful scheduling assistant.
You can suggest schedules but CANNOT create or modify shifts directly.
Always end suggestions with: "Would you like me to set this up? You'll need the Advanced plan."
Location data: {json.dumps(context, indent=2)}
Today: {datetime.utcnow().strftime('%A, %B %d, %Y')}"""

        messages = list(conversation_history or [])
        messages.append({"role": "user", "content": message})

        response = self._client().messages.create(
            model=self._model(), max_tokens=1500,
            system=system, messages=messages,
        )
        reply_text = response.content[0].text

        action_data = None
        if can_write and "```json" in reply_text:
            try:
                json_str = reply_text.split("```json")[1].split("```")[0].strip()
                action_data = json.loads(json_str)
            except (json.JSONDecodeError, IndexError):
                pass

        return {"reply": reply_text, "action_data": action_data, "model": self._model()}

    # ── Schedule generator ────────────────────────────────────────────────────
    def generate_schedule(self, *, location_id, week_start, manager_user_id, shifts_per_day=3, hours_per_shift=8):
        context = self._build_context(location_id)
        prompt = f"""Generate a complete 7-day schedule for the week starting {week_start}.
Location: {context['location_name']}
Staff: {json.dumps(context['staff'], indent=2)}
Availability: {json.dumps(context['availability'], indent=2)}
Existing shifts: {json.dumps(context['existing_shifts'], indent=2)}

Requirements:
- {shifts_per_day} shifts per day, each ~{hours_per_shift} hours
- Respect availability — do NOT schedule outside available times
- Distribute shifts fairly
- ISO 8601 times (e.g. 2024-01-15T09:00:00)

Respond ONLY with a JSON array:
[{{"user_id": 123, "start_time": "...", "end_time": "...", "break_minutes": 30, "notes": ""}}]"""

        response = self._client().messages.create(
            model=self._model(), max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        try:
            return json.loads(raw.strip())
        except json.JSONDecodeError as e:
            raise ValueError(f"AI returned invalid JSON: {e}")

    # ── Staffing predictor ────────────────────────────────────────────────────
    def predict_staffing(self, *, location_id, target_week):
        eight_weeks_ago = datetime.utcnow() - timedelta(weeks=8)
        historical = Shift.query.filter(
            Shift.location_id == location_id,
            Shift.status == "published",
            Shift.start_time >= eight_weeks_ago,
        ).all()

        day_counts = {d: [] for d in ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]}
        for shift in historical:
            day = shift.start_time.strftime("%A")
            day_counts[day].append(len(shift.assignments))

        history_summary = {
            day: {
                "avg_staff":   round(sum(c)/len(c), 1) if c else 0,
                "max_staff":   max(c) if c else 0,
                "data_points": len(c),
            }
            for day, c in day_counts.items()
        }

        prompt = f"""You are a staffing analyst. Predict staff needed each day for the week starting {target_week}.
Historical data (last 8 weeks): {json.dumps(history_summary, indent=2)}

Respond ONLY with JSON:
{{
  "predictions": {{
    "Monday":    {{"recommended_staff": 3, "confidence": "high", "reason": "..."}},
    "Tuesday":   {{"recommended_staff": 2, "confidence": "medium", "reason": "..."}},
    "Wednesday": {{"recommended_staff": 2, "confidence": "high", "reason": "..."}},
    "Thursday":  {{"recommended_staff": 3, "confidence": "high", "reason": "..."}},
    "Friday":    {{"recommended_staff": 5, "confidence": "high", "reason": "..."}},
    "Saturday":  {{"recommended_staff": 6, "confidence": "high", "reason": "..."}},
    "Sunday":    {{"recommended_staff": 4, "confidence": "medium", "reason": "..."}}
  }},
  "summary": "...",
  "warnings": []
}}"""

        response = self._client().messages.create(
            model=self._model(), max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        try:
            result = json.loads(raw.strip())
        except json.JSONDecodeError:
            result = {"raw": raw, "error": "Could not parse prediction"}
        result["target_week"]     = target_week
        result["location_id"]     = location_id
        result["history_summary"] = history_summary
        return result

    # ── Swap recommendations ──────────────────────────────────────────────────
    def recommend_swap_matches(self, *, swap_id, location_id):
        from models import ShiftSwap
        swap  = ShiftSwap.query.get(swap_id)
        shift = Shift.query.get(swap.shift_id)
        if not shift:
            return []

        shift_day   = shift.start_time.strftime("%a").lower()
        shift_start = shift.start_time.time()
        shift_end   = shift.end_time.time()

        emps = Employment.query.filter(
            Employment.location_id == location_id,
            Employment.status == "active",
            Employment.user_id != swap.requesting_user_id,
        ).all()

        eligible = []
        for emp in emps:
            avail = Availability.query.filter_by(
                emp_id=emp.emp_id, day_of_week=shift_day
            ).first()
            if avail and avail.start_time <= shift_start and avail.end_time >= shift_end:
                user = AppUser.query.get(emp.user_id)
                ws = shift.start_time.replace(hour=0, minute=0, second=0) - timedelta(
                    days=shift.start_time.weekday()
                )
                we = ws + timedelta(days=7)
                shift_count = (
                    db.session.query(ShiftAssignment)
                    .join(Shift)
                    .filter(ShiftAssignment.user_id == emp.user_id,
                            Shift.start_time >= ws, Shift.start_time < we)
                    .count()
                )
                eligible.append({
                    "user_id": emp.user_id,
                    "name":    user.display_name or user.username,
                    "role":    emp.role.name if emp.role else "Staff",
                    "shifts_this_week": shift_count,
                })

        if not eligible:
            return []

        prompt = f"""Rank these employees as swap candidates.
Shift: {shift.start_time.strftime('%A %I:%M %p')} - {shift.end_time.strftime('%I:%M %p')}
Role needed: {shift.role.name if shift.role else 'Any'}
Candidates: {json.dumps(eligible, indent=2)}

Rank by fewest shifts this week first (fairness), then role match.
Respond ONLY with JSON — top 3:
[{{"user_id": 123, "name": "Alice", "reason": "..."}}]"""

        response = self._client().messages.create(
            model=self._model(), max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        try:
            return json.loads(raw.strip())
        except json.JSONDecodeError:
            return eligible[:3]

    # ── Context builder ───────────────────────────────────────────────────────
    def _build_context(self, location_id: int) -> dict:
        location = Location.query.get(location_id)
        if not location:
            return {}
        emps  = Employment.query.filter_by(location_id=location_id, status="active").all()
        staff, availability_data = [], []
        for emp in emps:
            user = AppUser.query.get(emp.user_id)
            if not user:
                continue
            staff.append({
                "user_id": emp.user_id,
                "name":    user.display_name or user.username,
                "role":    emp.role.name if emp.role else "Staff",
                "emp_id":  emp.emp_id,
            })
            for av in Availability.query.filter_by(emp_id=emp.emp_id).all():
                availability_data.append({
                    "user_id":    emp.user_id,
                    "name":       user.display_name or user.username,
                    "day":        av.day_of_week,
                    "start_time": av.start_time.strftime("%H:%M"),
                    "end_time":   av.end_time.strftime("%H:%M"),
                })
        now      = datetime.utcnow()
        upcoming = Shift.query.filter(
            Shift.location_id == location_id,
            Shift.start_time >= now,
            Shift.start_time <= now + timedelta(days=14),
        ).all()
        return {
            "location_id":    location_id,
            "location_name":  location.loc_name,
            "timezone":       location.timezone,
            "staff":          staff,
            "availability":   availability_data,
            "existing_shifts": [
                {
                    "shift_id":    s.shift_id,
                    "start_time":  s.start_time.isoformat(),
                    "end_time":    s.end_time.isoformat(),
                    "status":      s.status,
                    "assigned_to": [a.user_id for a in s.assignments],
                }
                for s in upcoming
            ],
        }