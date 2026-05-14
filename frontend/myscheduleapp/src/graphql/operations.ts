// src/graphql/operations.ts
import { gql } from '@apollo/client';

/* ── Auth ──────────────────────────────────────────────────────────────────── */

// NOTE: Login is now done via REST in AuthContext.
// This mutation is kept for reference but not actively used.
export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
      refreshToken
      user {
        id
        username
        display_name
        user_email
        isActive
        role { id name isSystem }
        primaryLocation { id name }
      }
    }
  }
`;

export const ME_QUERY = gql`
  query Me {
    me {
      id
      username
      display_name
      user_email
      isActive
      role { id name isSystem }
      primaryLocation { id name }
    }
  }
`;

/* ── Locations ─────────────────────────────────────────────────────────────── */

export const MY_LOCATIONS_QUERY = gql`
  query MyLocations {
    myLocations {
      id
      name
      address
    }
  }
`;

/* ── Shifts ────────────────────────────────────────────────────────────────── */

export const SHIFTS_BY_LOCATION_QUERY = gql`
  query ShiftsByLocation($locationId: Int!) {
    shiftsByLocation(locationId: $locationId) {
      id
      startTime
      endTime
      role
      location { id name }
    }
  }
`;

/* ── Team ──────────────────────────────────────────────────────────────────── */

export const GET_TEAM_MEMBERS_QUERY = gql`
  query GetTeamMembers($locationId: Int!) {
    teamMembers(locationId: $locationId) {
      id
      username
      display_name
      user_email
      isActive
      role { id name isSystem }
    }
  }
`;

/* ── Roles ─────────────────────────────────────────────────────────────────── */

export const LOCATION_ROLES_QUERY = gql`
  query LocationRoles($locationId: Int!) {
    locationRoles(locationId: $locationId) {
      id
      name
      locationId
      isSystem
    }
  }
`;

export const CREATE_ROLE_MUTATION = gql`
  mutation CreateRole($locationId: Int!, $name: String!) {
    createRole(locationId: $locationId, name: $name) {
      id name locationId isSystem
    }
  }
`;

export const DELETE_ROLE_MUTATION = gql`
  mutation DeleteRole($roleId: Int!) {
    deleteRole(roleId: $roleId)
  }
`;

export const UPDATE_USER_ROLE_MUTATION = gql`
  mutation UpdateUserRole($empId: Int!, $roleId: Int!) {
    updateUserRole(empId: $empId, roleId: $roleId) {
      id username isActive
      role { id name isSystem }
    }
  }
`;

/* ── Invites ───────────────────────────────────────────────────────────────── */

export const SEND_ONBOARDING_INVITE_MUTATION = gql`
  mutation SendInvite($email: String!, $locationId: Int!, $position: String) {
    sendOnboardingInvite(email: $email, locationId: $locationId, position: $position) {
      inviteId
      email
    }
  }
`;