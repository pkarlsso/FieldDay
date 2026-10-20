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

export const CREATE_SESSION = gql`
  mutation CreateSession($hostId: ID!, $input: CreateSessionInput!) {
    createSession(hostId: $hostId, input: $input) {
      id sport startsAt location
      locationPoint { type coordinates }
      maxParticipants status
      host { id name }
      participants { id name }
    }
  }
`;

export const JOIN_SESSION = gql`
  mutation JoinSession($sessionId: ID!, $userId: ID!) {
    joinSession(sessionId: $sessionId, userId: $userId) {
      id participants { id name }
    }
  }
`;

export const LEAVE_SESSION = gql`
  mutation LeaveSession($sessionId: ID!, $userId: ID!) {
    leaveSession(sessionId: $sessionId, userId: $userId) {
      id participants { id name }
    }
  }
`;

export const GET_CONVERSATIONS = `
  query GetConversations {
    getConversations {
      id kind sessionId name unreadCount lastMessageAt
      participants { id name profilePicture }
      messages { id conversationId body createdAt mine read sender { id name profilePicture } }
    }
  }
`;

export const GET_CONVERSATION_MESSAGES = `
  query GetConversationMessages($conversationId: ID!, $cursor: String, $limit: Int) {
    getConversationMessages(conversationId: $conversationId, cursor: $cursor, limit: $limit) {
      nextCursor
      messages { id conversationId body createdAt mine read sender { id name profilePicture } }
    }
  }
`;

export const GET_OR_CREATE_DIRECT_CONVERSATION = `
  mutation GetOrCreateDirectConversation($friendId: ID!) {
    getOrCreateDirectConversation(friendId: $friendId) {
      id kind sessionId name unreadCount lastMessageAt
      participants { id name profilePicture }
      messages { id conversationId body createdAt mine read sender { id name profilePicture } }
    }
  }
`;

export const SEND_MESSAGE = `
  mutation SendMessage($conversationId: ID!, $body: String!, $clientMessageId: String!) {
    sendMessage(conversationId: $conversationId, body: $body, clientMessageId: $clientMessageId) {
      id conversationId body createdAt mine read sender { id name profilePicture }
    }
  }
`;

export const MARK_CONVERSATION_READ = `
  mutation MarkConversationRead($conversationId: ID!) {
    markConversationRead(conversationId: $conversationId)
  }
`;
