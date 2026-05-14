# extensions.py
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_mail import Mail
from flask_bcrypt import Bcrypt
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_socketio import SocketIO
from sqlalchemy import MetaData
from celery import Celery
import redis as redis_lib

convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

db       = SQLAlchemy(metadata=MetaData(naming_convention=convention))
migrate  = Migrate()
jwt      = JWTManager()
mail     = Mail()
bcrypt   = Bcrypt()
limiter  = Limiter(key_func=get_remote_address)
socketio = SocketIO(cors_allowed_origins="*", async_mode="eventlet")
celery   = Celery()

redis_client = None


def init_extensions(app):
    global redis_client

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    mail.init_app(app)
    bcrypt.init_app(app)
    limiter.init_app(app)
    socketio.init_app(app, message_queue=app.config.get("SOCKETIO_MESSAGE_QUEUE"))

    redis_client = redis_lib.from_url(
        app.config.get("REDIS_URL", "redis://localhost:6379/0"),
        decode_responses=True,
    )

    celery.conf.update(
        broker_url=app.config["CELERY_BROKER_URL"],
        result_backend=app.config["CELERY_RESULT_BACKEND"],
        task_serializer=app.config["CELERY_TASK_SERIALIZER"],
        result_serializer=app.config["CELERY_RESULT_SERIALIZER"],
        accept_content=app.config["CELERY_ACCEPT_CONTENT"],
        timezone=app.config["CELERY_TIMEZONE"],
    )

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        jti = jwt_payload.get("jti")
        if not jti:
            return False
        return redis_client.exists(f"blocklist:{jti}") == 1

    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return {"error": "Token has been revoked."}, 401

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return {"error": "Token has expired. Please log in again."}, 401

    @jwt.unauthorized_loader
    def missing_token_callback(err_str):
        return {"error": "Authorization required."}, 401

    @jwt.invalid_token_loader
    def invalid_token_callback(err_str):
        return {"error": "Invalid token."}, 422