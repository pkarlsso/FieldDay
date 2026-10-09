const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    email: String!
    bio: String
    hometown: String
    profilePicture: String
    sports: [String]
    sportSkills: [SportSkill!]!
    skillLevel: Float
    socialRating: Float
    totalRatings: Int
    friends: [User]
  }

  type SportSkill {
    sport: String!
    skillLevel: Float!
  }

  input SportSkillInput {
    sport: String!
    skillLevel: Int!
  }

  input UpdateProfileInput {
    name: String
    bio: String
    hometown: String
    profilePicture: String
    sportSkills: [SportSkillInput!]
  }

  type Session {
    id: ID!
    sport: String!
    date: String!
    time: String!
    startsAt: String!
    location: String!
    locationPoint: GeoPoint!
    skillRange: String
    tags: [String!]!
    distanceMiles: Float
    maxParticipants: Int
    participants: [User]
    host: User
    status: String
    rated: Boolean
  }

  type GeoPoint {
    type: String!
    coordinates: [Float!]!
  }

  input LocationPointInput {
    longitude: Float!
    latitude: Float!
  }

  input SessionDiscoveryFilterInput {
    origin: LocationPointInput
    maxDistanceMiles: Float
    sports: [String!]
    minSkillLevel: Float
    maxSkillLevel: Float
    startsAfter: String
    startsBefore: String
    minOpenSpots: Int
    tags: [String!]
  }

  input CreateSessionInput {
    sport: String!
    startsAt: String!
    location: String!
    locationPoint: LocationPointInput!
    skillRange: String
    skillMin: Float
    skillMax: Float
    tags: [String!]
    maxParticipants: Int
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

  # A stored rating. The rater is deliberately not exposed, so the ratings a
  # player receives stay anonymous.
  type Rating {
    id: ID!
    session: ID!
    ratee: ID!
    value: Int!
    createdAt: String!
  }

  type NotificationTarget {
    version: Int!
    screen: String!
    params: String!
  }

  type Notification {
    id: ID!
    type: String!
    category: String!
    title: String!
    body: String!
    target: NotificationTarget!
    readAt: String
    createdAt: String!
  }

  type NotificationPreferences {
    session: Boolean!
    friends: Boolean!
    ratings: Boolean!
    chat: Boolean!
  }

  type NotificationDevice {
    id: ID!
    platform: String!
    enabled: Boolean!
    lastSeenAt: String!
  }

  type EmailCheckResult {
    exists: Boolean!
    message: String
  }

  type AuthResult {
    success: Boolean!
    message: String
    userId: ID
    requiresTwoFactor: Boolean
    token: String
  }

  type Query {
    getUser(id: ID!): User
    getSession(id: ID!): Session
    getSessions(status: String, filter: SessionDiscoveryFilterInput): [Session]
    getCompletedSessions(userId: ID!): [Session]
    getFriends(userId: ID!): [User]
    checkEmailExists(email: String!): EmailCheckResult!
    getRatingsForUser(userId: ID!): [Rating!]!
    getRatingsBySession(sessionId: ID!, raterId: ID!): [Rating!]!
    getNotifications(limit: Int = 30, before: String): [Notification!]!
    getUnreadNotificationCount: Int!
    getNotificationPreferences: NotificationPreferences!
    getNotificationDevices: [NotificationDevice!]!
  }

  type Mutation {
    createSession(hostId: ID!, input: CreateSessionInput!): Session
    joinSession(sessionId: ID!, userId: ID!): Session
    leaveSession(sessionId: ID!, userId: ID!): Session
    submitRatings(sessionId: ID!, raterId: ID!, ratings: [RatingInput!]!): RatingResult
    addFriend(userId: ID!, friendId: ID!): User
    signUp(email: String!, password: String!): AuthResult!
    login(email: String!, password: String!): AuthResult!
    resendTwoFactorCode(email: String!): AuthResult!
    verifyTwoFactorCode(email: String!, code: String!): AuthResult!
    requestPasswordReset(email: String!): AuthResult!
    resetPassword(email: String!, code: String!, newPassword: String!): AuthResult!
    googleSignIn(idToken: String!): AuthResult!
    restoreSession(token: String!): AuthResult!
    logout(token: String!): AuthResult!
    updateProfile(input: UpdateProfileInput!): User!
    markNotificationRead(id: ID!): Notification!
    markAllNotificationsRead: Int!
    registerNotificationDevice(token: String!, platform: String!): NotificationDevice!
    unregisterNotificationDevice(token: String!): Boolean!
    updateNotificationPreferences(session: Boolean, friends: Boolean, ratings: Boolean, chat: Boolean): NotificationPreferences!
  }
`;

export default typeDefs;
