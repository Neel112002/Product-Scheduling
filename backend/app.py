import os
from flask import Flask, jsonify
from dotenv import load_dotenv
from config import DevConfig, ProdConfig
from extensions import db, migrate

# 👇 Import models so Flask-Migrate "sees" them
import models  # IMPORTANT

def create_app():
    load_dotenv()
    app = Flask(__name__)
    app.config.from_object(ProdConfig if os.getenv("FLASK_ENV") == "production" else DevConfig)

    db.init_app(app)
    migrate.init_app(app, db)

    @app.get("/")
    def root():
        return jsonify({"message": "Work Scheduler Flask API is running 🚀"})

    return app

# WSGI/Flask entrypoint
app = create_app()

# Run code
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
