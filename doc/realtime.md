# Live session updates

People looking at the same session see its roster change without restarting
the app (issue #207). This uses Socket.IO on the existing backend, so later
real-time features such as chat can share the same connection.

## How it works

1. A change happens on the server: a session is created, someone joins or
   leaves, or a session starts or ends (by the clock).
2. The server sends `session:updated` with `{ sessionId, reason, at }`.
   `reason` is `created`, `edited`, `cancelled`, `joined`, `left`,
   `checked_in`, `started` or `ended`.
3. Each screen that shows that session refetches it through GraphQL.

The event only says *which* session changed, never who is in it. What a client
sees after refetching still goes through the same GraphQL rules as any other
request.

## Who gets an event

Even a session id and a reason reveal that a session exists and when people
join it, so events follow the same rule as `canViewSession`:

- **Public sessions:** every connection, signed in or not.
- **Friends-only and invite-only sessions:** only the host, the players, and
  the host's friends or the invitees. A player who leaves still gets that
  `left` event.

The app sends its sign-in token when it connects (`auth: { token }`), and each
signed-in connection joins a `user:<id>` room that private events are sent to.
A connection without a valid token only gets public-session events. The app
reconnects when the signed-in user changes.

Starting and ending happen by the clock, not through a mutation, so the server
checks every 30 seconds for sessions that crossed either time
(`checkSessionClock` in `backend/src/realtime.js`).

## Keeping rosters correct

- `joinSession` checks for an open spot and adds the player in one atomic
  MongoDB update. Two people can't both take the last spot, even if both had a
  stale screen showing it open. The loser gets `Session is full`.
- `leaveSession` uses `$pull`, so a join that lands at the same moment isn't
  overwritten.
- After a failed join, the details screen refetches, so it shows the real
  roster and a disabled **Session is full** button.

## Disconnects

The app opens one connection (`frontend/src/realtime.js`) and starts with HTTP
long-polling, then upgrades to a WebSocket when it can. When the connection
drops and comes back, screens get a `{ resync: true }` event and refetch
everything, so events missed while offline are never needed. Screens also
still refetch when they regain focus, so the app works without the live
connection, just less promptly.

## Configuration

- Server: Socket.IO shares the HTTP server and port with GraphQL, at
  `/socket.io`. Browser connections are limited to the same origins as GraphQL
  (`CSRF_ALLOWED_ORIGINS`). Native apps send no Origin header and are allowed.
- App: `EXPO_PUBLIC_REALTIME_URL`. It defaults to `EXPO_PUBLIC_API_URL`
  without `/graphql`.
- Deployment: the production API is reached through API Gateway, which
  forwards HTTP but not WebSockets. Long-polling works there as long as
  `/socket.io/*` is routed to the backend. If the backend runs on more than one
  instance, the load balancer needs sticky sessions for polling.

## Tests

`npm run test:realtime` checks events for create, join, leave, start and end;
a stale join on a full session; four simultaneous joins for one spot; a join
and a leave at the same time; a client that disconnects and reconnects; and
that friends-only and invite-only session events reach only the people who
may see the session, never signed-out clients or strangers.
