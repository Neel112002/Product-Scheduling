# controllers/swap_controller.py
from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity
from services.swap_service import SwapService
from models import Employment, Shift, ShiftAssignment
from extensions import db

svc = SwapService()


class SwapController:

    def request_open(self):
        try:
            user_id  = int(get_jwt_identity())
            data     = request.get_json(silent=True) or {}
            shift_id = data.get("shift_id")
            reason   = (data.get("reason") or "").strip() or None
            if not shift_id:
                return jsonify({"error": "shift_id required"}), 400
            swap = svc.request_open(requesting_user_id=user_id, shift_id=shift_id, reason=reason)
            return jsonify({"message": "Open swap posted", "swap": svc.serialize(swap)}), 201
        except (ValueError, PermissionError) as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({"error": "Something went wrong"}), 500

    def request_targeted(self):
        try:
            user_id           = int(get_jwt_identity())
            data              = request.get_json(silent=True) or {}
            shift_id          = data.get("shift_id")
            receiving_user_id = data.get("receiving_user_id")
            offered_shift_id  = data.get("offered_shift_id")
            reason            = (data.get("reason") or "").strip() or None
            if not all([shift_id, receiving_user_id, offered_shift_id]):
                return jsonify({"error": "shift_id, receiving_user_id, offered_shift_id required"}), 400
            swap = svc.request_targeted(
                requesting_user_id=user_id,
                shift_id=int(shift_id),
                receiving_user_id=int(receiving_user_id),
                offered_shift_id=int(offered_shift_id),
                reason=reason,
            )
            return jsonify({"message": "Targeted swap sent", "swap": svc.serialize(swap)}), 201
        except (ValueError, PermissionError) as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({"error": "Something went wrong"}), 500

    def make_offer(self, swap_id: int):
        try:
            user_id          = int(get_jwt_identity())
            data             = request.get_json(silent=True) or {}
            offered_shift_id = data.get("offered_shift_id")
            if not offered_shift_id:
                return jsonify({"error": "offered_shift_id required"}), 400
            swap = svc.make_offer(user_id=user_id, swap_id=swap_id, offered_shift_id=int(offered_shift_id))
            return jsonify({"message": "Offer made", "swap": svc.serialize(swap)}), 200
        except (ValueError, PermissionError) as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({"error": "Something went wrong"}), 500

    def retract_offer(self, swap_id: int):
        try:
            user_id = int(get_jwt_identity())
            swap = svc.retract_offer(user_id=user_id, swap_id=swap_id)
            return jsonify({"message": "Offer retracted", "swap": svc.serialize(swap)}), 200
        except (ValueError, PermissionError) as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({"error": "Something went wrong"}), 500

    def accept(self, swap_id: int):
        try:
            user_id = int(get_jwt_identity())
            swap = svc.accept(user_id=user_id, swap_id=swap_id)
            return jsonify({"message": "Swap accepted", "swap": svc.serialize(swap)}), 200
        except (ValueError, PermissionError) as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({"error": "Something went wrong"}), 500

    def reject(self, swap_id: int):
        try:
            user_id = int(get_jwt_identity())
            swap = svc.reject(user_id=user_id, swap_id=swap_id)
            return jsonify({"message": "Swap rejected", "swap": svc.serialize(swap)}), 200
        except (ValueError, PermissionError) as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({"error": "Something went wrong"}), 500

    def cancel(self, swap_id: int):
        try:
            user_id = int(get_jwt_identity())
            swap = svc.cancel(user_id=user_id, swap_id=swap_id)
            return jsonify({"message": "Swap cancelled", "swap": svc.serialize(swap)}), 200
        except (ValueError, PermissionError) as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({"error": "Something went wrong"}), 500

    def my_swaps(self):
        try:
            user_id = int(get_jwt_identity())
            swaps   = svc.get_my_swaps(user_id)
            return jsonify({"swaps": [svc.serialize(s) for s in swaps]}), 200
        except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({"error": "Something went wrong"}), 500

    def incoming(self):
        try:
            user_id = int(get_jwt_identity())
            swaps   = svc.get_incoming(user_id)
            return jsonify({"swaps": [svc.serialize(s) for s in swaps]}), 200
        except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({"error": "Something went wrong"}), 500

    def marketplace(self):
        try:
            user_id     = int(get_jwt_identity())
            location_id = request.args.get("location_id", type=int)
            if not location_id:
                emp = Employment.query.filter_by(user_id=user_id, status="active").first()
                location_id = emp.location_id if emp else None
            if not location_id:
                return jsonify({"swaps": []}), 200
            swaps = svc.get_open_marketplace(location_id, exclude_user_id=user_id)
            return jsonify({"swaps": [svc.serialize(s) for s in swaps]}), 200
        except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({"error": "Something went wrong"}), 500

    def my_shifts_for_offer(self):
        try:
            user_id = int(get_jwt_identity())
            shifts  = svc.get_my_shifts_for_offer(user_id)
            return jsonify({
                "shifts": [
                    {
                        "shift_id":      s.shift_id,
                        "start_time":    s.start_time.isoformat(),
                        "end_time":      s.end_time.isoformat(),
                        "break_minutes": s.break_minutes,
                        "role":          s.role.name if s.role else None,
                    }
                    for s in shifts
                ]
            }), 200
        except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({"error": "Something went wrong"}), 500

    def get_colleagues(self):
        try:
            user_id = int(get_jwt_identity())
            emp = Employment.query.filter_by(user_id=user_id, status="active").first()
            if not emp:
                return jsonify({"colleagues": []}), 200
            colleagues = Employment.query.filter(
                Employment.location_id == emp.location_id,
                Employment.status      == "active",
                Employment.user_id     != user_id,
            ).all()
            return jsonify({
                "colleagues": [
                    {
                        "user_id":      c.user.user_id,
                        "username":     c.user.username,
                        "display_name": c.user.display_name,
                        "role":         c.role.name if c.role else None,
                    }
                    for c in colleagues if c.user
                ]
            }), 200
        except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({"error": "Something went wrong"}), 500

    def get_colleague_shifts(self, colleague_id: int):
        try:
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            shifts = (
                db.session.query(Shift)
                .join(ShiftAssignment, ShiftAssignment.shift_id == Shift.shift_id)
                .filter(
                    ShiftAssignment.user_id == colleague_id,
                    Shift.status            == "published",
                    Shift.start_time        > now,
                )
                .all()
            )
            return jsonify({
                "shifts": [
                    {
                        "shift_id":      s.shift_id,
                        "start_time":    s.start_time.isoformat(),
                        "end_time":      s.end_time.isoformat(),
                        "break_minutes": s.break_minutes,
                        "role":          s.role.name if s.role else None,
                        "assignments":   [{"user_id": a.user_id} for a in s.assignments],
                    }
                    for s in shifts
                ]
            }), 200
        except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({"error": "Something went wrong"}), 500

    def pending_manager(self):
        try:
            location_id = request.args.get("location_id", type=int)
            if not location_id:
                return jsonify({"error": "location_id required"}), 400
            swaps = svc.get_pending_manager(location_id)
            return jsonify({
                "swaps": [svc.serialize(s, include_conflicts=True) for s in swaps]
            }), 200
        except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({"error": "Something went wrong"}), 500

    def manager_decide(self, swap_id: int):
        try:
            manager_id = int(get_jwt_identity())
            data       = request.get_json(silent=True) or {}
            approve    = bool(data.get("approve", False))
            result     = svc.manager_decide(swap_id=swap_id, manager_user_id=manager_id, approve=approve)
            return jsonify({
                "message":   "Decision recorded",
                "swap":      svc.serialize(result["swap"]),
                "conflicts": result["conflicts"],
            }), 200
        except (ValueError, PermissionError) as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({"error": "Something went wrong"}), 500