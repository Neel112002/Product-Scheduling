from typing import Optional

from ariadne import QueryType, MutationType, ObjectType
from graphql import GraphQLError
from flask_jwt_extended import create_access_token, create_refresh_token

from extensions import db
from models import AppUser, Location, Employment, Role, Company, OnboardingInvite
from services.auth_service import AuthService
from services.team_service import TeamService
from services.rbac_service import can_modify_role

from datetime import date


query = QueryType()
mutation = MutationType()

auth_payload = ObjectType("AuthPayload")
user_object = ObjectType("User")
role_object = ObjectType("Role")
location_object = ObjectType("Location")
company_object = ObjectType("Company")

auth_service = AuthService()
team_service = TeamService()


# =====================================================
# Helpers
# =====================================================

def get_current_user(info) -> Optional[AppUser]:
    return info.context.get("current_user")


def require_user(info) -> AppUser:
    user = get_current_user(info)
    if not user:
        raise GraphQLError("Authentication required")
    return user


# =====================================================
# AuthPayload Resolvers
# =====================================================

@auth_payload.field("accessToken")
def resolve_auth_access(obj, *_):
    return obj["accessToken"]


@auth_payload.field("refreshToken")
def resolve_auth_refresh(obj, *_):
    return obj["refreshToken"]


@auth_payload.field("user")
def resolve_auth_user(obj, *_):
    return obj["user"]


# =====================================================
# ID Mapping
# =====================================================

@user_object.field("id")
def resolve_user_id(user: AppUser, *_):
    return user.user_id


@role_object.field("id")
def resolve_role_id(role: Role, *_):
    return role.role_id


@location_object.field("id")
def resolve_location_id(location: Location, *_):
    return location.loc_id


@company_object.field("id")
def resolve_company_id(company: Company, *_):
    return company.comp_id


# =====================================================
# Role Field Mapping
# =====================================================

@role_object.field("locationId")
def resolve_role_location_id(role: Role, *_):
    return role.location_id


@role_object.field("isSystem")
def resolve_role_is_system(role: Role, *_):
    return role.is_system


# =====================================================
# Location Field Mapping
# =====================================================

@location_object.field("name")
def resolve_location_name(location: Location, *_):
    return location.loc_name


@location_object.field("address")
def resolve_location_address(location: Location, *_):
    return location.loc_address


@location_object.field("company")
def resolve_location_company(location: Location, *_):
    return location.company


# =====================================================
# Company Field Mapping
# =====================================================

@company_object.field("name")
def resolve_company_name(company: Company, *_):
    return company.comp_name


@company_object.field("email")
def resolve_company_email(company: Company, *_):
    return company.comp_email


@company_object.field("address")
def resolve_company_address(company: Company, *_):
    return company.comp_address


# =====================================================
# User Field Mapping
# =====================================================

@user_object.field("isActive")
def resolve_user_is_active(user: AppUser, *_):
    for emp in user.employments:
        if emp.status == "active":
            return True
    return False


@user_object.field("role")
def resolve_user_role(user: AppUser, *_):
    for emp in user.employments:
        if emp.status == "active" and emp.role:
            return emp.role
    raise GraphQLError("User has no active role assigned")


@user_object.field("company")
def resolve_user_company(user: AppUser, *_):
    for emp in user.employments:
        if emp.status == "active" and emp.company:
            return emp.company
    return None


@user_object.field("primaryLocation")
def resolve_user_primary_location(user: AppUser, *_):
    for emp in user.employments:
        if emp.status == "active" and emp.location:
            return emp.location
    return None


# =====================================================
# Queries
# =====================================================

@query.field("me")
def resolve_me(_, info):
    return get_current_user(info)


@query.field("myLocations")
def resolve_my_locations(_, info):
    user = require_user(info)

    return (
        db.session.query(Location)
        .join(Employment, Employment.location_id == Location.loc_id)
        .filter(
            Employment.user_id == user.user_id,
            Employment.status == "active"
        )
        .all()
    )


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


@query.field("locationRoles")
def resolve_location_roles(_, info, locationId: int):
    user = require_user(info)

    emp = Employment.query.filter_by(
        user_id=user.user_id,
        location_id=locationId,
        status="active"
    ).first()

    if not emp:
        raise GraphQLError("Forbidden")

    return Role.query.filter_by(location_id=locationId).all()


# =====================================================
# Mutations
# =====================================================

@mutation.field("login")
def resolve_login(_, info, email: str, password: str):
    user = auth_service.authenticate(
        email.strip().lower(),
        password.strip()
    )

    if not user:
        raise GraphQLError("Invalid email or password")

    access = create_access_token(identity=str(user.user_id), fresh=True)
    refresh = create_refresh_token(identity=str(user.user_id))

    return {
        "accessToken": access,
        "refreshToken": refresh,
        "user": user,
    }


@mutation.field("createRole")
def resolve_create_role(_, info, locationId: int, name: str):
    user = require_user(info)

    current_emp = Employment.query.filter_by(
        user_id=user.user_id,
        location_id=locationId,
        status="active"
    ).first()

    if not current_emp or current_emp.role.name.lower() != "owner":
        raise GraphQLError("Only owner can create roles")

    existing = Role.query.filter_by(
        location_id=locationId,
        name=name.strip()
    ).first()

    if existing:
        raise GraphQLError("Role already exists")

    role = Role(
        name=name.strip(),
        location_id=locationId,
        is_system=False,
        created_by=user.user_id,
    )

    db.session.add(role)
    db.session.commit()

    return role


@mutation.field("deleteRole")
def resolve_delete_role(_, info, roleId: int):
    user = require_user(info)

    role = Role.query.get(roleId)
    if not role:
        raise GraphQLError("Role not found")

    current_emp = Employment.query.filter_by(
        user_id=user.user_id,
        location_id=role.location_id,
        status="active"
    ).first()

    if not current_emp or current_emp.role.name.lower() != "owner":
        raise GraphQLError("Only owner can delete roles")

    if role.is_system:
        raise GraphQLError("System roles cannot be deleted")

    if role.employments:
        raise GraphQLError("Role has assigned users")

    db.session.delete(role)
    db.session.commit()

    return True


@mutation.field("updateUserRole")
def resolve_update_user_role(_, info, empId: int, roleId: int):
    user = require_user(info)

    target_emp = Employment.query.get(empId)
    new_role = Role.query.get(roleId)

    if not target_emp or not new_role:
        raise GraphQLError("Invalid input")

    current_emp = Employment.query.filter_by(
        user_id=user.user_id,
        location_id=target_emp.location_id,
        status="active"
    ).first()

    if not current_emp:
        raise GraphQLError("Forbidden")

    if new_role.location_id != target_emp.location_id:
        raise GraphQLError("Cross-location assignment forbidden")

    if not can_modify_role(current_emp, target_emp):
        raise GraphQLError("Forbidden")

    if new_role.name.lower() == "owner" and target_emp.role.name.lower() != "owner":
        raise GraphQLError("Cannot assign Owner role")

    target_emp.role_id = new_role.role_id
    db.session.commit()

    return target_emp.user


@mutation.field("sendOnboardingInvite")
def resolve_send_onboarding_invite(_, info, email: str, locationId: int, position: Optional[str] = None):

    user = require_user(info)

    email = email.strip().lower()

    emp = Employment.query.filter_by(
        user_id=user.user_id,
        location_id=locationId,
        status="active"
    ).first()

    if not emp:
        raise GraphQLError("Forbidden")

    role_name = emp.role.name.lower()

    if role_name not in ["owner", "manager"]:
        raise GraphQLError("Only owner or manager can invite staff")

    existing = OnboardingInvite.query.filter_by(
        email=email,
        location_id=locationId,
        status="pending"
    ).first()

    if existing:
        raise GraphQLError("Invite already exists")

    role = None

    if position:
        role = Role.query.filter_by(
            location_id=locationId,
            name=position.strip()
        ).first()

        if not role:
            raise GraphQLError("Role not found")

    invite = OnboardingInvite(
        comp_id=emp.comp_id,
        location_id=locationId,
        email=email,
        status="pending"
    )

    db.session.add(invite)
    db.session.flush()

    pending_emp = Employment(
        user_id=None,
        comp_id=emp.comp_id,
        location_id=locationId,
        role_id=role.role_id if role else emp.role_id,
        status="pending",
        start_date=date.today()
    )

    db.session.add(pending_emp)
    db.session.commit()

    return {
        "inviteId": invite.form_id,
        "email": invite.email
    }