# app.py
import os
from flask import Flask, app, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

from config import DevConfig, ProdConfig
from extensions import init_extensions, socketio

import models  # noqa: F401 — needed for Flask-Migrate


def create_app():
    app = Flask(__name__)
    app.config.from_object(
        ProdConfig if os.getenv("FLASK_ENV") == "production" else DevConfig
    )

    init_extensions(app)

    CORS(app, resources={r"/*": {"origins": os.getenv("CORS_ORIGINS", "*")}})

    # REST Blueprints
    from routes.auth          import router as auth_router
    from routes.onboarding    import router as onboarding_router
    from routes.availability  import router as availability_router
    from routes.admin         import admin_bp
    from routes.shifts        import router as shifts_router
    from routes.swaps         import router as swaps_router
    from routes.notifications import router as notifications_router
    from routes.ai            import router as ai_router
    from routes.time_entries  import router as time_entries_router
    from routes.analytics     import analytics_bp
    from routes.drops         import drops_bp
    from routes.time_off import time_off_bp
    from routes.messaging import messaging_bp
    
    app.register_blueprint(auth_router)
    app.register_blueprint(onboarding_router)
    app.register_blueprint(availability_router)
    app.register_blueprint(admin_bp)
    app.register_blueprint(shifts_router)
    app.register_blueprint(swaps_router)
    app.register_blueprint(notifications_router)
    app.register_blueprint(ai_router)
    app.register_blueprint(time_entries_router)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(drops_bp)
    app.register_blueprint(time_off_bp)
    app.register_blueprint(messaging_bp)
    
    # GraphQL
    from gql_server.graphql_server import register_graphql_route
    register_graphql_route(app)

    # WebSockets
    from routes.sockets import register_socket_handlers
    register_socket_handlers()

    @app.get("/ping")
    def ping():
        return jsonify({"ok": True})

    @app.get("/")
    def root():
        return jsonify({"message": "Work Scheduler API 🚀", "version": "2.0.0"})

    @app.get("/health")
    def health():
        from extensions import redis_client
        redis_ok = False
        try:
            redis_ok = redis_client.ping() if redis_client else False
        except Exception:
            pass
        return jsonify({"status": "ok", "redis": redis_ok}), 200

    with app.app_context():
        from extensions import db
        db.create_all()

    return app


app = create_app()

if __name__ == "__main__":
    socketio.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
        debug=os.getenv("FLASK_ENV") != "production",
    )