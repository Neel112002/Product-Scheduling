# routes/analytics.py
from flask              import Blueprint
from flask_jwt_extended import jwt_required
from controllers.analytics_controller import AnalyticsController

analytics_bp = Blueprint('analytics', __name__, url_prefix='/admin/analytics')
ctrl         = AnalyticsController()


@analytics_bp.get('/')
@jwt_required()
def get_analytics():
    return ctrl.get_analytics()