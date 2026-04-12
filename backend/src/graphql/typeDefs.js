const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    email: String!
    bio: String
    sports: [String]
    skillLevel: Float
    socialRating: Float
    totalRatings: Int
    friends: [User]
  }

  type Session {
    id: ID!
    sport: String!
    date: String!
    time: String!
    location: String!
    skillRange: String
    maxParticipants: Int
    participants: [User]
    host: User
    status: String
    rated: Boolean
  }

  type RatingResult {
    success: Boolean!
    message: String
    avgRatingGiven: Float
    friendRequestsSent: Int
    updatedUsers: [User]
  }

  input RatingInput {
    userId: ID!
    rating: Int!
    addFriend: Boolean
  }

  type Query {
    getUser(id: ID!): User
    getSessions(status: String): [Session]
    getCompletedSessions(userId: ID!): [Session]
    getFriends(userId: ID!): [User]
  }

  type Mutation {
    submitRatings(sessionId: ID!, raterId: ID!, ratings: [RatingInput!]!): RatingResult
    addFriend(userId: ID!, friendId: ID!): User
  }
`;

module.exports = typeDefs;
