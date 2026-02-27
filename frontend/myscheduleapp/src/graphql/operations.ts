// src/graphql/operations.ts
import { gql } from '@apollo/client';

// ---------- Auth ----------

export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
      refreshToken
      user {
        user_id
        username
        user_email
        display_name
        role
        company {
          id
          name
        }
        primaryLocation {
          id
          name
        }
      }
    }
  }
`;

export const ME_QUERY = gql`
  query Me {
    me {
      user_id
      username
      user_email
      display_name
      role
      company {
        id
        name
      }
      primaryLocation {
        id
        name
      }
    }
  }
`;

// ---------- Locations & shifts ----------

export const MY_LOCATIONS_QUERY = gql`
  query MyLocations {
    myLocations {
      id
      name
      address
    }
  }
`;

export const SHIFTS_BY_LOCATION_QUERY = gql`
  query ShiftsByLocation($locationId: Int!) {
    shiftsByLocation(locationId: $locationId) {
      id
      role
      startTime
      endTime
      location {
        id
        name
      }
    }
  }
`;

// ---------- Admin / invites ----------

export const SEND_INVITE_MUTATION = gql`
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

// ---------- Profile update (for setup screen) ----------

export const UPDATE_PROFILE_MUTATION = gql`
  mutation UpdateProfile($displayName: String, $phone: String) {
    updateProfile(displayName: $displayName, phone: $phone) {
      user_id
      username
      user_email
      display_name
      role
      company {
        id
        name
      }
      primaryLocation {
        id
        name
      }
    }
  }
`;

export const SEND_ONBOARDING_INVITE_MUTATION = gql`
  mutation SendInvite($email: String!, $locationId: Int!, $position: String) {
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

export const GET_TEAM_MEMBERS_QUERY = gql`
  query GetTeamMembers($locationId: Int!) {
    teamMembers(locationId: $locationId) {
      id
      username
      user_email
      display_name
      role
      isActive
    }
  }
`;