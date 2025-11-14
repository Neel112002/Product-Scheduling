# extensions.py
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from sqlalchemy import MetaData
from flask_mail import Mail

mail = Mail()
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}
db = SQLAlchemy(metadata=MetaData(naming_convention=convention))
migrate = Migrate()
jwt = JWTManager()

def init_extensions(app):
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    mail.init_app(app)

    # ⬇️ Do NOT import models at module level; import inside the loader to avoid
    # circular imports and to work with a single-file models.py.
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        from models import TokenBlacklist  # local import (models.py)
        jti = jwt_payload.get("jti")
        if not jti:
            return False 
        # Fast existence check; returns True if revoked
        return db.session.query(TokenBlacklist.id).filter_by(jti=jti).first() is not None

    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return {"error": "Token has been revoked."}, 401

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return {"error": "Token has expired."}, 401

    @jwt.unauthorized_loader
    def missing_token_callback(err_str):
        return {"error": f"Missing or invalid token: {err_str}"}, 401

    @jwt.invalid_token_loader
    def invalid_token_callback(err_str):
        return {"error": f"Invalid token: {err_str}"}, 422
