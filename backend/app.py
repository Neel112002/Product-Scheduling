# app.py
import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()  # <-- load env BEFORE importing config

from config import DevConfig, ProdConfig
from extensions import db, migrate, jwt

# Import models so Alembic sees them
import models

# Blueprints
from routes.auth import router as auth_router
from routes.onboarding import router as onboarding_router

def create_app():
    app = Flask(__name__)
    app.config.from_object(ProdConfig if os.getenv("FLASK_ENV") == "production" else DevConfig)

    # Extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    CORS(app, resources={r"/*": {"origins": "*"}})

    # Blueprints
    app.register_blueprint(auth_router)
    app.register_blueprint(onboarding_router)

    @app.get("/")
    def root():
        return jsonify({"message": "Work Scheduler Flask API is running 🚀"})

    return app

app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
