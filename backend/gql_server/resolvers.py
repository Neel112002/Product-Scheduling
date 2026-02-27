from datetime import datetime
from typing import Optional

from ariadne import QueryType, MutationType, ObjectType
from graphql import GraphQLError
from flask_jwt_extended import create_access_token, create_refresh_token

from extensions import db
from models import AppUser, Company, Location, Employment, Shift
from services.auth_service import AuthService
from services.onboarding_service import OnboardingService
from services.team_service import TeamService


query = QueryType()
mutation = MutationType()
auth_payload = ObjectType("AuthPayload")
user_object = ObjectType("User")   # 🔥 NEW


auth_service = AuthService()
onboarding_service = OnboardingService()
team_service = TeamService()


# ================================
# Helpers
# ================================

def get_current_user(info) -> Optional[AppUser]:
    return info.context.get("current_user")


def require_user(info) -> AppUser:
    user = get_current_user(info)
    if not user:
        raise GraphQLError("Authentication required")
    return user


def map_company(company: Company):
    if not company:
        return None
    return {
        "id": company.comp_id,
        "name": company.comp_name,
        "email": company.comp_email,
        "address": company.comp_address,
    }


def map_location(location: Location):
    if not location:
        return None
    return {
        "id": location.loc_id,
        "name": location.loc_name,
        "address": location.loc_address,
    }


def map_user(user: AppUser):

    role = None
    is_active = False
    company = None
    primary_location = None

    employments = getattr(user, "employments", []) or []

    for emp in employments:
        if emp.status == "active":
            role = (emp.position or "").strip().lower()
            is_active = True
            company = emp.company
            primary_location = emp.location
            break

    return {
        "id": user.user_id,
        "user_id": user.user_id,
        "username": user.username,
        "user_email": user.user_email,
        "display_name": user.display_name,
        "role": role,
        "isActive": bool(is_active),  # 🔥 ALWAYS BOOLEAN
        "company": map_company(company),
        "primaryLocation": map_location(primary_location),
    }


# ================================
# 🔥 GraphQL Type Safety Layer
# ================================

@user_object.field("isActive")
def resolve_user_is_active(obj, *_):

    # If resolver returned dict
    if isinstance(obj, dict):
        value = obj.get("isActive")
        return bool(value) if value is not None else False

    # If resolver returned SQLAlchemy model
    if hasattr(obj, "is_active"):
        return bool(obj.is_active)

    return False


# ================================
# Queries
# ================================

@query.field("me")
def resolve_me(_, info):
    user = get_current_user(info)
    if not user:
        return None
    return map_user(user)


@query.field("myLocations")
def resolve_my_locations(_, info):
    user = require_user(info)

    locations = (
        db.session.query(Location)
        .join(Employment, Employment.location_id == Location.loc_id)
        .filter(
            Employment.user_id == user.user_id,
            Employment.status == "active"
        )
        .all()
    )

    return [map_location(loc) for loc in locations]


@query.field("shiftsByLocation")
def resolve_shifts_by_location(_, info, locationId: int):
    user = require_user(info)

    shifts = (
        Shift.query
        .filter_by(location_id=locationId, user_id=user.user_id)
        .order_by(Shift.start_time.asc())
        .all()
    )

    return [
        {
            "id": s.shift_id,
            "location": map_location(s.location),
            "startTime": s.start_time,
            "endTime": s.end_time,
            "role": getattr(s, "role", None) or getattr(s, "status", None),
        }
        for s in shifts
    ]


@query.field("teamMembers")
def resolve_team_members(_, info, locationId: int):
    user = require_user(info)

    try:
        return team_service.get_team_members(
            requester_id=user.user_id,
            location_id=locationId
        )

    except PermissionError:
        raise GraphQLError("Forbidden")

    except Exception:
        raise GraphQLError("Something went wrong")


# ================================
# Mutations
# ================================

@mutation.field("login")
def resolve_login(_, info, email: str, password: str):
    user = auth_service.authenticate(email.strip().lower(), password.strip())

    if not user:
        raise GraphQLError("Invalid email or password")

    access = create_access_token(identity=str(user.user_id), fresh=True)
    refresh = create_refresh_token(identity=str(user.user_id))

    return {
        "accessToken": access,
        "refreshToken": refresh,
        "user": map_user(user),
    }


@auth_payload.field("accessToken")
def resolve_authpayload_access_token(obj, info):
    return obj.get("accessToken")


@auth_payload.field("refreshToken")
def resolve_authpayload_refresh_token(obj, info):
    return obj.get("refreshToken")


@auth_payload.field("user")
def resolve_authpayload_user(obj, info):
    return obj.get("user")