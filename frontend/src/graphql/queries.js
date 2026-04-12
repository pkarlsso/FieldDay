import { gql } from '@apollo/client';

export const GET_USER = gql`
  query GetUser($id: ID!) {
    getUser(id: $id) {
      id
      name
      email
      bio
      sports
      skillLevel
      socialRating
      totalRatings
      friends {
        id
        name
        socialRating
        sports
      }
    }
  }
`;

export const GET_COMPLETED_SESSIONS = gql`
  query GetCompletedSessions($userId: ID!) {
    getCompletedSessions(userId: $userId) {
      id
      sport
      date
      time
      location
      skillRange
      participants {
        id
        name
        skillLevel
        socialRating
      }
      host {
        id
        name
      }
      status
      rated
    }
  }
`;

export const SUBMIT_RATINGS = gql`
  mutation SubmitRatings($sessionId: ID!, $raterId: ID!, $ratings: [RatingInput!]!) {
    submitRatings(sessionId: $sessionId, raterId: $raterId, ratings: $ratings) {
      success
      message
      avgRatingGiven
      friendRequestsSent
      updatedUsers {
        id
        name
        socialRating
      }
    }
  }
`;
