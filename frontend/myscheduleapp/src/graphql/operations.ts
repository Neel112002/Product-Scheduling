// src/graphql/operations.ts
import { gql } from '@apollo/client';

/* =========================================================
   AUTH
========================================================= */

export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
      refreshToken
      user {
        id
        username
        isActive
        role {
          id
          name
          isSystem
        }
      }
    }
  }
`;

export const ME_QUERY = gql`
  query Me {
    me {
      id
      username
      isActive
      role {
        id
        name
        isSystem
      }
      primaryLocation {
        id
        name
      }
    }
  }
`;

/* =========================================================
   LOCATIONS
========================================================= */

export const MY_LOCATIONS_QUERY = gql`
  query MyLocations {
    myLocations {
      id
      name
      address
    }
  }
`;

/* =========================================================
   SHIFTS
   ⚠️ Updated to assume relational role
   If backend still uses string role, revert this section only.
========================================================= */

export const SHIFTS_BY_LOCATION_QUERY = gql`
  query ShiftsByLocation($locationId: Int!) {
    shiftsByLocation(locationId: $locationId) {
      id
      startTime
      endTime
      location {
        id
        name
      }
      role {
        id
        name
      }
    }
  }
`;

/* =========================================================
   TEAM MEMBERS
========================================================= */

export const GET_TEAM_MEMBERS_QUERY = gql`
  query GetTeamMembers($locationId: Int!) {
    teamMembers(locationId: $locationId) {
      id
      username
      user_email
      display_name
      isActive
      role {
        id
        name
        isSystem
      }
    }
  }
`;

/* =========================================================
   LOCATION ROLES
========================================================= */

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

/* =========================================================
   ROLE MANAGEMENT
========================================================= */

export const CREATE_ROLE_MUTATION = gql`
  mutation CreateRole($locationId: Int!, $name: String!) {
    createRole(locationId: $locationId, name: $name) {
      id
      name
      locationId
      isSystem
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
      id
      username
      isActive
      role {
        id
        name
        isSystem
      }
    }
  }
`;

/* =========================================================
   PROFILE
========================================================= */

export const UPDATE_PROFILE_MUTATION = gql`
  mutation UpdateProfile($displayName: String, $phone: String) {
    updateProfile(displayName: $displayName, phone: $phone) {
      id
      username
      isActive
      role {
        id
        name
        isSystem
      }
      primaryLocation {
        id
        name
      }
    }
  }
`;

/* =========================================================
   INVITES
   ⚠️ Backend may soon migrate this to roleId instead of position.
========================================================= */

export const SEND_ONBOARDING_INVITE_MUTATION = gql`
  mutation SendInvite(
    $email: String!
    $locationId: Int!
    $position: String
  ) {
    sendOnboardingInvite(
      email: $email
      locationId: $locationId
      position: $position
    ) {
      inviteId
      email
    }
  }
`;