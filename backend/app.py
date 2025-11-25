# app.py
import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()  # <-- load env BEFORE importing config

from config import DevConfig, ProdConfig
from extensions import init_extensions

# Import models so Alembic sees them
import models

# Blueprints
from routes.auth import router as auth_router
from routes.onboarding import router as onboarding_router
from routes.availability import router as availability_router
from routes.admin import admin_bp

# GraphQL
from gql_server.graphql_server import register_graphql_route


def create_app():
    app = Flask(__name__)
    app.config.from_object(ProdConfig if os.getenv("FLASK_ENV") == "production" else DevConfig)

    # Mail + email feature flags
    app.config.update(
        MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
        MAIL_PORT=int(os.getenv("MAIL_PORT", "587")),
        MAIL_USE_TLS=os.getenv("MAIL_USE_TLS", "true").lower() == "true",
        MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
        MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
        MAIL_DEFAULT_SENDER=os.getenv("MAIL_DEFAULT_SENDER"),
        EMAIL_SENDING_ENABLED=os.getenv("EMAIL_SENDING_ENABLED", "false").lower() == "true",
    )

    # Init DB, JWT, Mail, etc.
    init_extensions(app)

    # CORS – wide open for now (Expo + LAN)
    CORS(
        app,
        resources={r"/*": {"origins": "*"}}
        # If you want stricter:
        # resources={r"/*": {"origins": [
        #     "http://localhost:19006",
        #     "http://127.0.0.1:19006",
        #     "http://192.168.0.0/16",
        # ]}}
    )

    # REST Blueprints
    app.register_blueprint(auth_router)
    app.register_blueprint(onboarding_router)
    app.register_blueprint(availability_router)
    app.register_blueprint(admin_bp)

    # GraphQL endpoint (/graphql)
    register_graphql_route(app)

    @app.get("/ping")
    def ping():
        return {"ok": True}

    @app.get("/")
    def root():
        return jsonify({"message": "Work Scheduler Flask API is running 🚀"})

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
