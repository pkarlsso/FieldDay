# Reference - Team 4 (FieldDay)

## System Structure

| Component | Location | Responsibility |
| --- | --- | --- |
| Mobile client | `frontend/` | Expo/React Native app for iOS, Android, and web. It presents screens, stores the sign-in token securely, calls GraphQL, and receives live updates. |
| API server | `backend/src/` | Node.js/Express application hosting Apollo GraphQL, authentication, authorization, session rules, notifications, and integration services. |
| Database | MongoDB via Mongoose | Stores accounts, sports sessions, friendships, messages, ratings, notifications, device tokens, media, and auth sessions. |
| Real-time transport | Socket.IO | Sends session and chat updates over `/socket.io`; clients refetch protected data through GraphQL after an event. |
| External services | Google OAuth, Amazon SES/SMTP, Gorse | Provide optional Google sign-in, email delivery, and recommendation ranking. |



## Key APIs and Interfaces

The public application interface is GraphQL. The schema is defined in `backend/src/graphql/typeDefs.js`; all protected operations identify the acting user from the bearer token rather than from a user ID supplied by the client.

### GraphQL endpoint

| Item | Value |
| --- | --- |
| Default local URL | `http://localhost:4000/graphql` |
| Production client default | `https://sgbtn5pq84.execute-api.us-east-2.amazonaws.com/graphql` |
| Protocol | HTTP(S) GraphQL |
| Authentication | `Authorization: Bearer <token>` for signed-in operations |
| Payload limit | 300 KB (large enough for allowed profile-photo uploads) |

### Session operations

| Operation | Type | Purpose | Access / important behavior |
| --- | --- | --- |
| `getSessions(status, filter)` | Query | Finds sessions by time, sport, location, skill, tags, and capacity. | Returns only sessions visible to the caller. |
| `getSession(id)` | Query | Retrieves one visible session. | Fails when the session does not exist or is not visible. |
| `createSession(input)` | Mutation | Creates a session and adds the creator as host and first participant. | Requires sign-in; sessions can be public, friends-only, or invite-only. |
| `joinSession(sessionId)` | Mutation | Adds the signed-in user to a session roster. | Rejects hosts, duplicate joins, full sessions, started sessions, invisible sessions, and users in cooldown. |
| `leaveSession(sessionId)` | Mutation | Removes a participant before the session begins. | Hosts cannot leave their own sessions. |
| `editSession(sessionId, input)` | Mutation | Edits start/end time, location, or capacity. | Host only; cannot reduce capacity below the existing roster size. |
| `cancelSession(sessionId)` | Mutation | Cancels a session. | Host only; a cancelled session is removed from discovery and cannot be joined. |
| `checkInToSession(sessionId, latitude, longitude)` | Mutation | Records attendance by location. | Participant only; accepted from session start through 10 minutes afterward and within 200 m of the session. |
| `reportNoShows(sessionId, noShowUserIds)` | Mutation | Records a participant's no-show report. | Available after session end until the no-show deadline. |

`CreateSessionInput` requires `sport`, `startsAt`, `location`, `locationPoint`, `skillLevel`, `tags`, and `maxParticipants`. `locationPoint` uses `{ longitude, latitude }`, while MongoDB persists coordinates as `[longitude, latitude]`.

### Account and social operations

| Operation group | Operations | Notes |
| --- | --- | --- |
| Authentication | `signUp`, `login`, `verifyTwoFactorCode`, `resendTwoFactorCode`, `requestPasswordReset`, `resetPassword`, `googleSignIn`, `restoreSession`, `logout` | Email/password accounts use two-factor verification; Google sign-in accepts an ID token. |
| Profile | `me`, `getUser`, `updateProfile`, `uploadProfilePhoto` | Profiles include sports, per-sport skill levels, availability, bio, hometown, and an optional photo. |
| Friends | `getFriends`, `searchUsersByName`, `sendFriendRequest`, `acceptFriendRequest`, `declineFriendRequest`, `addFriend` | Direct chat requires a friendship or a shared session, depending on the action. |
| Ratings | `submitRatings`, `getRatingsForUser`, `getRatingsBySession` | Ratings are integer values from 1 to 5. A unique database index prevents a duplicate rating for the same session/rater/ratee combination. |
| Chat | `getConversations`, `getConversation`, `getConversationMessages`, `getOrCreateDirectConversation`, `sendMessage`, `markConversationRead` | Messages support cursor pagination and a client-generated message ID to prevent duplicates. |
| Notifications | `getNotifications`, `getUnreadNotificationCount`, `markNotificationRead`, `markAllNotificationsRead`, `registerNotificationDevice`, `updateNotificationPreferences` | Notification preferences cover session, friends, ratings, and chat categories. |

### Socket.IO interface

| Event | Direction | Payload | Meaning |
| --- | --- | --- |
| `session:updated` | Server to client | `{ sessionId, reason, at }` | A session was created, edited, cancelled, joined, left, checked in, started, or ended. The client must refetch through GraphQL. |
| `joinConversation` | Client to server | `conversationId`, callback | Requests access to a conversation room; access is verified server-side. |
| `message` | Server to client | Message object | Delivers a new message to authorized conversation members. |

The client opens one Socket.IO connection using its token. Public-session events go to all connections. Private-session events go only to the host, players, the host's friends (friends-only), or invitees (invite-only). If a connection is restored, the client refreshes data rather than relying on missed events.

## Configuration

### Backend environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string. The server will not start without it. |
| `PORT` | No | HTTP port; defaults to `4000`. |
| `CSRF_ALLOWED_ORIGINS` | Production web deployments | Comma-separated browser origins allowed to call GraphQL and Socket.IO. |
| `AUTH_DEMO_BYPASS` | No | Set to `true` only for demonstration; skips emailed two-factor codes. Do not enable for real users. |
| `DISABLE_NO_SHOW_RATINGS_JOB` | No | Set to `true` when a local server shares a database with the deployed server, preventing duplicate background rating jobs. |
| `EMAIL_PROVIDER` | No | Set to `ses` to use Amazon SES; SMTP is used when SMTP variables are present. |
| `AWS_REGION`, `SES_FROM` | With SES | Region and verified sender for Amazon SES email. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | With SMTP | SMTP transport configuration. |
| `GOOGLE_CLIENT_IDS` | With Google sign-in | Comma-separated OAuth client IDs accepted by the backend. |
| `GORSE_BASE_URL`, `GORSE_API_KEY`, `GORSE_ID_SECRET` | With Gorse recommendations | Connection and signing settings for the Gorse recommendation service. Non-local Gorse requires HTTPS and an API key. |
| `LOG_DIR`, `LOG_LEVEL`, `NODE_ENV` | No | Logging location, level, and environment. |

### Frontend environment variables

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | GraphQL endpoint. Defaults to the deployed API URL above. |
| `EXPO_PUBLIC_REALTIME_URL` | Socket.IO base URL. Defaults to `EXPO_PUBLIC_API_URL` with `/graphql` removed. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth web client ID. |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth iOS client ID; also used by native Expo configuration. |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth Android client ID. |
| `EXPO_PUBLIC_MAP_PROVIDER` | Set to `google` to use Google Maps on iOS; the default iOS provider is Apple Maps. |
| `EXPO_PUBLIC_LIVE_DATA` | Set to `false` to use mock data in screens that support it. |

Do not commit secret values, OAuth secrets, database URIs, API keys, or production sender credentials.

## DB Schemas

All persistent data is stored in MongoDB through Mongoose models.

### Core collections

| Collection | Key fields | Relationships and constraints |
| --- | --- | --- |
| `users` | name, email, sports, sportSkills, availability, socialRating, friends, authentication fields | Email is unique. `sportSkills` stores skill levels 1-5. `friends` contains User IDs. `cooldownUntil` blocks creating and joining sessions after a low rating. |
| `sessions` | sport, startsAt, endsAt, location, locationPoint, participants, host, visibility, attendance/rating fields | Uses a 2dsphere index on `locationPoint` and indexes for sport/time, participants/time, end time, invitees, and no-show processing. |
| `ratings` | session, rater, ratee, value, createdAt | Rating is an integer from 1-5. One rating per session/rater/ratee is enforced by a unique index. |
| `friendrequests` | requester, recipient, status, timestamps | Only one pending request for a requester/recipient pair is permitted. |
| `conversations` | kind, session, participants, participantKey, lastMessageAt | A session has at most one session conversation; direct conversations have a unique participant key. |
| `messages` | conversation, sender, body, clientMessageId, readBy, createdAt | Body length is limited to 2,000 characters. `(conversation, clientMessageId)` is unique to make message sending idempotent. |

### Support collections

| Collection | Purpose |
| --- | --- |
| `authsessions` | Stores hashes of long-lived login tokens. The expiry field has a MongoDB TTL index for automatic removal. |
| `media` | Stores approved JPEG, PNG, or WebP profile-photo bytes. Unattached uploads receive an expiry date and are deleted automatically. |
| `notifications` | Stores per-user notification content, category, navigation target, and read timestamp. |
| `notificationpreferences` | Stores one set of category preferences per user. |
| `devicetokens` | Stores enabled iOS/Android notification-device tokens for users. |

## Project Specific Section 1: Session Lifecycle and Access Control

| Item | Values / rule |
| --- | --- |
| Visibility | `PUBLIC`, `FRIENDS`, or `INVITE_ONLY`. Older documents without a stored visibility are treated as public. |
| Status | `upcoming`, `in_progress`, `completed`, or `cancelled`. Except for cancellation, status is derived from the clock using `startsAt` and `endsAt`. |
| Default duration | Two hours when no `endsAt` is provided. An end time may be no more than 24 hours after start. |
| Attendance | New sessions can require location check-in. Older sessions use peer no-show reports. |
| Capacity | `maxParticipants` includes the host. Joining uses an atomic MongoDB update, so two users cannot claim the final place simultaneously. |

## Project Specific Section 2: Real-Time Updates and Privacy

| Item | Reference |
| --- | --- |
| Authorization | The signed-in user is resolved from the bearer token; protected actions do not accept a user ID as proof of identity. |
| Browser access | Requests from origins outside `CSRF_ALLOWED_ORIGINS` are rejected. |
| GeoJSON coordinates | `locationPoint` coordinates use `[longitude, latitude]`. |
| Discovery filters | Origin, maximum distance, sports, skill range, time range, open spots, and tags. |
| Recommendations | `recommendedSessions` returns ranked upcoming sessions for the signed-in user. |
| Email delivery | Amazon SES or SMTP sends account verification and password-reset emails. |
| Socket.IO path | `/socket.io` |
| Private-session event audience | Host, participants, and either host friends or invitees, based on visibility. |
| Reconnection | Client refetches data after reconnecting. |
| Session clock | Backend checks for session start/end transitions every 30 seconds. |

## Important Source Files

| File | Use it when you need to... |
| --- | --- |
| `backend/src/graphql/typeDefs.js` | Check the complete GraphQL types, inputs, queries, and mutations. |
| `backend/src/graphql/resolvers.js` | Inspect validation and authorization behavior for each operation. |
| `backend/src/models/` | Check MongoDB fields, relationships, defaults, and indexes. |
| `backend/src/index.js` | Review server startup, HTTP routes, CORS/CSRF handling, and background jobs. |
| `backend/src/realtime.js` | Review session-update events, audiences, and the session clock. |
| `frontend/src/api.js` | Inspect GraphQL client transport and authorization headers. |
| `frontend/src/realtime.js` | Inspect Socket.IO connection and client resynchronization behavior. |
| `frontend/src/config.js` | Check client endpoint and OAuth environment configuration. |
| `doc/realtime.md` | Read the expanded live-update behavior and test expectations. |
| `doc/ses-email.md` | Read the SES setup and deployment requirements. |

