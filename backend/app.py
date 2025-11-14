# app.py
import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()  # <-- load env BEFORE importing config

from config import DevConfig, ProdConfig
from extensions import db, migrate, jwt
from extensions import init_extensions


# Import models so Alembic sees them
import models

# Blueprints
from routes.auth import router as auth_router
from routes.onboarding import router as onboarding_router
from routes.availability import router as availability_router
def create_app():
    app = Flask(__name__)
    app.config.from_object(ProdConfig if os.getenv("FLASK_ENV") == "production" else DevConfig)

    app.config.update(
        MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
        MAIL_PORT=int(os.getenv("MAIL_PORT", "587")),
        MAIL_USE_TLS=os.getenv("MAIL_USE_TLS", "true").lower() == "true",
        MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
        MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
        MAIL_DEFAULT_SENDER=os.getenv("MAIL_DEFAULT_SENDER"),
        EMAIL_SENDING_ENABLED=os.getenv("EMAIL_SENDING_ENABLED", "false").lower() == "true",
    )

    init_extensions(app)
    
    # Extensions
    CORS(app, resources={r"/*": {"origins": "*"}})

    # Blueprints
    app.register_blueprint(auth_router)
    app.register_blueprint(onboarding_router)
    app.register_blueprint(availability_router)
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
