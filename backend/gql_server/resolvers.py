# gql_server/resolvers.py
from datetime import datetime
from typing import Any, Dict, List, Optional

from ariadne import QueryType, MutationType, ObjectType
from graphql import GraphQLError
from flask_jwt_extended import create_access_token, create_refresh_token

from extensions import db
from models import AppUser, Company, Location, Employment, Shift
from services.auth_service import AuthService
from services.onboarding_service import OnboardingService

# Root types
query = QueryType()
mutation = MutationType()
auth_payload = ObjectType("AuthPayload")  # <-- NEW

auth_service = AuthService()
onboarding_service = OnboardingService()

# ---------- Helpers ----------

def get_current_user(info) -> Optional[AppUser]:
    return info.context.get("current_user")


def require_user(info) -> AppUser:
    user = get_current_user(info)
    if not user:
        raise GraphQLError("Authentication required")
    return user


def map_company(company: Company) -> Dict[str, Any]:
    return {
        "id": company.comp_id,
        "name": company.comp_name,
        "email": company.comp_email,
        "address": company.comp_address,
    }


def map_location(location: Location) -> Dict[str, Any]:
    return {
        "id": location.loc_id,
        "name": location.loc_name,
        "address": location.loc_address,
    }


def map_user(user: AppUser) -> Dict[str, Any]:
    if not user:
        return None

    role = None
    primary_location = None
    company = None

    for emp in user.employments:
        if emp.status == "active":
            role = (emp.position or "").strip().lower()
            primary_location = emp.location
            company = emp.company
            break

    return {
        "user_id": user.user_id,
        "username": user.username,
        "user_email": user.user_email,
        "display_name": user.display_name,
        "role": role,
        "company": map_company(company) if company else None,
        "primaryLocation": map_location(primary_location) if primary_location else None,
    }


def map_shift(shift: Shift) -> Dict[str, Any]:
    role_value = getattr(shift, "role", None) or getattr(shift, "status", None)
    return {
        "id": shift.shift_id,
        "location": map_location(shift.location),
        "startTime": shift.start_time,
        "endTime": shift.end_time,
        "role": role_value,
    }


# ---------- Query resolvers ----------

@query.field("me")
def resolve_me(_, info):
    user = get_current_user(info)
    if not user:
        return None
    return map_user(user)


@query.field("myLocations")
def resolve_my_locations(_, info) -> List[Dict[str, Any]]:
    user = require_user(info)

    active_emps = (
        Employment.query
        .filter_by(user_id=user.user_id, status="active")
        .all()
    )
    if not active_emps:
        return []

    loc_ids = {e.location_id for e in active_emps if e.location_id is not None}
    if not loc_ids:
        return []

    locations = (
        Location.query
        .filter(Location.loc_id.in_(loc_ids))
        .order_by(Location.loc_name.asc())
        .all()
    )
    return [map_location(loc) for loc in locations]


@query.field("shiftsByLocation")
def resolve_shifts_by_location(_, info, locationId: int) -> List[Dict[str, Any]]:
    user = require_user(info)

    shifts = (
        Shift.query
        .filter_by(location_id=locationId, user_id=user.user_id)
        .order_by(Shift.start_time.asc())
        .all()
    )
    return [map_shift(s) for s in shifts]


# ---------- Mutation resolvers ----------

@mutation.field("login")
def resolve_login(_, info, email: str, password: str):
    email = (email or "").strip().lower()
    password = (password or "").strip()

    if not email or not password:
        raise GraphQLError("email and password are required")

    user = auth_service.authenticate(email, password)
    if not user:
        raise GraphQLError("Invalid email or password")

    # Optional: enforce email verification
    # if not user.is_verified:
    #     raise GraphQLError("Email not verified")

    identity = str(user.user_id)
    access = create_access_token(identity=identity, fresh=True)
    refresh = create_refresh_token(identity=identity)

    # This dict is the "AuthPayload" object
    return {
        "accessToken": access,
        "refreshToken": refresh,
        "user": map_user(user),
    }


@mutation.field("sendOnboardingInvite")
def resolve_send_onboarding_invite(_, info, email: str, locationId: int, position: Optional[str] = None):
    user = require_user(info)

    active_emps = [
        e for e in user.employments
        if e.status == "active"
           and (e.position or "").strip().lower() in ("owner", "manager", "admin")
    ]
    if not active_emps:
        raise GraphQLError("Not authorized to send invites")

    admin_emp = active_emps[0]
    comp_id = admin_emp.comp_id

    location = (
        Location.query
        .filter_by(loc_id=locationId, comp_id=comp_id)
        .first()
    )
    if not location:
        raise GraphQLError("Invalid locationId for this company")

    pos = (position or "Staff").strip()

    # NOTE: adapt this to your actual OnboardingService signature
    invite, token = onboarding_service.create_invite(
        comp_id=comp_id,
        email=email,
        location_id=locationId,
        position=pos,
    )

    return {
        "userId": None,           # you can fill this once you create user at accept time
        "inviteId": int(invite.form_id),
        "email": email.strip().lower(),
    }


@mutation.field("createShift")
def resolve_create_shift(_, info, locationId: int, startTime, endTime, role: Optional[str] = None):
    user = require_user(info)

    emp = (
        Employment.query
        .filter_by(user_id=user.user_id, location_id=locationId, status="active")
        .first()
    )
    if not emp:
        raise GraphQLError("You are not employed at this location")

    if isinstance(startTime, str):
        start_dt = datetime.fromisoformat(startTime)
    else:
        start_dt = startTime

    if isinstance(endTime, str):
        end_dt = datetime.fromisoformat(endTime)
    else:
        end_dt = endTime

    shift = Shift(
        location_id=locationId,
        user_id=user.user_id,
        start_time=start_dt,
        end_time=end_dt,
        status=role or "scheduled",
    )
    db.session.add(shift)
    db.session.commit()

    return map_shift(shift)


@mutation.field("updateProfile")
def resolve_update_profile(_, info, displayName: Optional[str] = None, phone: Optional[str] = None):
    user = require_user(info)

    if displayName is not None:
        user.display_name = displayName.strip() or None

    db.session.commit()
    return map_user(user)


# ---------- AuthPayload field resolvers (explicit) ----------

@auth_payload.field("accessToken")
def resolve_authpayload_access_token(obj, info):
    # obj is the dict returned by resolve_login
    return obj.get("accessToken")


@auth_payload.field("refreshToken")
def resolve_authpayload_refresh_token(obj, info):
    return obj.get("refreshToken")


@auth_payload.field("user")
def resolve_authpayload_user(obj, info):
    return obj.get("user")
