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
    # Older sessions without a stored end are given startsAt + 2 hours.
    endsAt: String!
    location: String!
    locationPoint: GeoPoint!
    skillRange: String
    # 1 beginner, 2 intermediate, 3 advanced. Null on older sessions.
    skillLevel: Int
    tags: [String!]!
    distanceMiles: Float
    maxParticipants: Int
    participants: [User]
    host: User
    # "upcoming", "in_progress" (started, not ended) or "completed" (ended).
    # Derived from the clock, so sessions end without anyone marking them.
    status: String
    rated: Boolean
    createdAt: String
    # When the session ended. Null until then.
    completedAt: String
    # Last moment to answer "who didn't show up?". Null until the session ends.
    noShowDeadline: String
    attendance: [Attendance!]!
    # The signed-in user's own no-show answer, or null if they haven't given one.
    myNoShowReport: NoShowReport
    # Whether the signed-in user may rate this session, and why not if not.
    ratingEligibility: RatingEligibility!
  }

  enum AttendanceStatus {
    SHOWED_UP
    NO_SHOW
  }

  # One row per participant. NO_SHOW once most of the other players who
  # answered the no-show check said this player didn't come.
  type Attendance {
    user: User!
    status: AttendanceStatus!
    # How many other players reported this player as a no-show.
    noShowReports: Int!
  }

  type NoShowReport {
    noShows: [ID!]!
    reportedAt: String!
  }

  type RatingEligibility {
    eligible: Boolean!
    reason: String
  }

  # The signed-in user's sessions, split for the Home and My Sessions screens.
  # hosted and joined hold sessions that haven't ended; completed holds ended ones.
  type MySessions {
    hosted: [Session!]!
    joined: [Session!]!
    completed: [Session!]!
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
    # Optional: defaults to 2 hours after startsAt. At most 24 hours after it.
    endsAt: String
    location: String!
    locationPoint: LocationPointInput!
    # Ignored: the server derives the stored range from skillLevel. Kept so
    # older app builds that still send them are not rejected.
    skillRange: String
    skillMin: Float
    skillMax: Float
    # Required: 1 beginner, 2 intermediate, 3 advanced.
    skillLevel: Int
    tags: [String!]
    # Required: total players including the host.
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
    getMySessions: MySessions!
    getFriends(userId: ID!): [User]
    checkEmailExists(email: String!): EmailCheckResult!
    getRatingsForUser(userId: ID!): [Rating!]!
    getRatingsBySession(sessionId: ID!, raterId: ID!): [Rating!]!
  }

  type Mutation {
    createSession(hostId: ID!, input: CreateSessionInput!): Session
    joinSession(sessionId: ID!, userId: ID!): Session
    leaveSession(sessionId: ID!, userId: ID!): Session
    # Participants only, after the session ends and before noShowDeadline.
    # Pass an empty list if everyone showed up. Can be changed until you rate.
    reportNoShows(sessionId: ID!, noShowUserIds: [ID!]!): Session!
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
  }
`;

export default typeDefs;
