# auth_middleware.py
from typing import Optional, Tuple, Dict, Any

from flask import Request
from flask_jwt_extended import decode_token
from werkzeug.exceptions import Unauthorized
from extensions import db
from models import AppUser


def get_current_user_from_request(request: Request) -> Tuple[Optional[AppUser], Optional[Dict[str, Any]]]:
    """
    Extracts the JWT from Authorization header, decodes it, and returns (user, payload).
    If no token or invalid token, returns (None, None) rather than raising.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None, None

    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None, None

    try:
        decoded = decode_token(token)
    except Exception:
        # Invalid or expired token – treat as anonymous in GraphQL
        return None, None

    identity = decoded.get("sub")
    if not identity:
        return None, decoded

    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        return None, decoded

    user = db.session.get(AppUser, user_id)
    return user, decoded


def build_graphql_context(request: Request) -> Dict[str, Any]:
    """
    Builds the context object passed to GraphQL resolvers.
    """
    user, jwt_payload = get_current_user_from_request(request)
    return {
        "request": request,
        "current_user": user,
        "jwt": jwt_payload,
    }


class AuthRequiredError(Unauthorized):
    """Custom exception for unauthenticated access in resolvers."""
    description = "Authentication required"
