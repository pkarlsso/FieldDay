const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    email: String!
    bio: String
    hometown: String
    # An image URI ready for <Image source={{ uri }}>, or '' when unset.
    profilePicture: String
    sports: [String]
    sportSkills: [SportSkill!]!
    skillLevel: Float
    availability: [Availability!]!
    socialRating: Float
    totalRatings: Int
    friends: [User]
    # True once the first-run setup has everything it needs.
    profileComplete: Boolean!
    # What first-run setup still needs: any of "name", "sports" and
    # "availability". Empty when profileComplete is true. A photo is optional.
    profileSetupMissing: [String!]!
  }

  enum Weekday {
    MON
    TUE
    WED
    THU
    FRI
    SAT
    SUN
  }

  enum DayPeriod {
    MORNING
    AFTERNOON
    EVENING
  }

  # The parts of one weekday the user is usually free to play.
  type Availability {
    day: Weekday!
    periods: [DayPeriod!]!
  }

  input AvailabilityInput {
    day: Weekday!
    periods: [DayPeriod!]!
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
    # An id from uploadProfilePhoto, or '' to remove the photo.
    profilePhotoId: ID
    sportSkills: [SportSkillInput!]
    # Replaces the whole weekly schedule. Days with no periods are dropped.
    availability: [AvailabilityInput!]
  }

  type UploadedMedia {
    id: ID!
    contentType: String!
  }

  enum SessionVisibility {
    # Anyone can find and join it.
    PUBLIC
    # Only the host's friends can find and join it.
    FRIENDS
    # Only people the host invited can find and join it.
    INVITE_ONLY
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
    visibility: SessionVisibility!
    # Who the host invited. Only the host sees this list; everyone else gets [].
    invitees: [User!]!
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
    # Defaults to PUBLIC.
    visibility: SessionVisibility
    # People to invite. Only allowed for INVITE_ONLY sessions.
    inviteeIds: [ID!]
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

  type ChatParticipant {
    id: ID!
    name: String!
    profilePicture: String
  }

  type Message {
    id: ID!
    conversationId: ID!
    sender: ChatParticipant!
    body: String!
    createdAt: String!
    mine: Boolean!
    read: Boolean!
  }

  type Conversation {
    id: ID!
    kind: String!
    sessionId: ID
    name: String!
    participants: [ChatParticipant!]!
    messages: [Message!]!
    unreadCount: Int!
    lastMessageAt: String
  }

  type MessagePage {
    messages: [Message!]!
    nextCursor: String
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

  # Operations that act for a user take who they are from the signed-in
  # request (the "Authorization: Bearer <token>" header), never from an
  # argument, and fail with code UNAUTHENTICATED when nobody is signed in.
  type Query {
    # The signed-in user, or null when signed out.
    me: User
    getUser(id: ID!): User
    # Fails with "Session not found" for sessions the caller can't see.
    getSession(id: ID!): Session
    # Only returns sessions the caller is allowed to see.
    getSessions(status: String, filter: SessionDiscoveryFilterInput): [Session]
    # Ended sessions the signed-in user still has to rate.
    getCompletedSessions: [Session]
    getMySessions: MySessions!
    getFriends(userId: ID!): [User]
    checkEmailExists(email: String!): EmailCheckResult!
    getRatingsForUser(userId: ID!): [Rating!]!
    getConversations: [Conversation!]!
    getConversationMessages(conversationId: ID!, cursor: String, limit: Int): MessagePage!
    getNotifications(limit: Int = 30, before: String): [Notification!]!
    getUnreadNotificationCount: Int!
    getNotificationPreferences: NotificationPreferences!
    getNotificationDevices: [NotificationDevice!]!
    # The ratings the signed-in user gave in a session.
    getRatingsBySession(sessionId: ID!): [Rating!]!
  }

  type Mutation {
    # The signed-in user becomes the host and first participant.
    createSession(input: CreateSessionInput!): Session
    # Fails if you host the session, already joined, it is full, it has
    # started, or you are not allowed to see it.
    joinSession(sessionId: ID!): Session
    # Only before the session starts. The host can't leave.
    leaveSession(sessionId: ID!): Session
    # Host only, before the session ends. For INVITE_ONLY sessions.
    inviteToSession(sessionId: ID!, userIds: [ID!]!): Session!
    # Host only. Stops the person finding or joining the session; if they
    # already joined, they keep their spot.
    uninviteFromSession(sessionId: ID!, userId: ID!): Session!
    # Participants only, after the session ends and before noShowDeadline.
    # Pass an empty list if everyone showed up. Can be changed until you rate.
    reportNoShows(sessionId: ID!, noShowUserIds: [ID!]!): Session!
    submitRatings(sessionId: ID!, ratings: [RatingInput!]!): RatingResult
    # Only with someone you have played a session with.
    addFriend(friendId: ID!): User
    signUp(email: String!, password: String!): AuthResult!
    login(email: String!, password: String!): AuthResult!
    resendTwoFactorCode(email: String!): AuthResult!
    verifyTwoFactorCode(email: String!, code: String!): AuthResult!
    requestPasswordReset(email: String!): AuthResult!
    resetPassword(email: String!, code: String!, newPassword: String!): AuthResult!
    googleSignIn(idToken: String!): AuthResult!
    restoreSession(token: String!): AuthResult!
    logout(token: String!): AuthResult!
    # Stores a photo for the signed-in user and returns its id for
    # updateProfile(input: { profilePhotoId }). Takes a JPEG, PNG or WebP data
    # URI of at most 150 KB. Uploads that are never saved are deleted after a day.
    uploadProfilePhoto(image: String!): UploadedMedia!
    updateProfile(input: UpdateProfileInput!): User!
    getOrCreateDirectConversation(friendId: ID!): Conversation!
    sendMessage(conversationId: ID!, body: String!, clientMessageId: String!): Message!
    markConversationRead(conversationId: ID!): Boolean!
    markNotificationRead(id: ID!): Notification!
    markAllNotificationsRead: Int!
    registerNotificationDevice(token: String!, platform: String!): NotificationDevice!
    unregisterNotificationDevice(token: String!): Boolean!
    updateNotificationPreferences(session: Boolean, friends: Boolean, ratings: Boolean, chat: Boolean): NotificationPreferences!
  }
`;

export default typeDefs;
