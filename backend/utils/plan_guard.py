# utils/plan_guard.py
from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from models import AppUser

PLANS = ["free", "advanced", "professional"]


def require_plan(minimum_plan: str):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            user_id = get_jwt_identity()
            if not user_id:
                return jsonify({"error": "Unauthorized"}), 401
            user = AppUser.query.get(int(user_id))
            if not user:
                return jsonify({"error": "User not found"}), 404
            emp = next((e for e in user.employments if e.status == "active"), None)
            if not emp or not emp.company:
                return jsonify({"error": "No active employment found"}), 403
            company_plan = (emp.company.plan or "free").lower()
            try:
                user_level     = PLANS.index(company_plan)
                required_level = PLANS.index(minimum_plan.lower())
            except ValueError:
                return jsonify({"error": "Invalid plan configuration"}), 500
            if user_level < required_level:
                return jsonify({
                    "error":         "Plan upgrade required",
                    "current_plan":  company_plan,
                    "required_plan": minimum_plan,
                    "message":       f"This feature requires the {minimum_plan.title()} plan.",
                    "upgrade_url":   "/settings/billing",
                }), 403
            return f(*args, **kwargs)
        return wrapped
    return decorator


def get_company_plan(user_id: int) -> str:
    user = AppUser.query.get(user_id)
    if not user:
        return "free"
    emp = next((e for e in user.employments if e.status == "active"), None)
    if not emp or not emp.company:
        return "free"
    return (emp.company.plan or "free").lower()