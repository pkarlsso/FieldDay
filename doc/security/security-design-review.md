# FieldDay Security Design Review Evidence

This page holds the diagrams referenced by the team's Security Design Review submission. It is intentionally kept close to the deployed architecture so we can update it as the app changes.

## Data-flow diagram

```mermaid
flowchart LR
  U["FieldDay user - iOS app"]
  F["Expo React Native client"]
  G["API Gateway - HTTPS boundary"]
  B["Node Express Apollo GraphQL API on Elastic Beanstalk"]
  M[("MongoDB Atlas: users, sessions, memberships, profiles")]
  O["Google OAuth identity provider"]
  P["Expo push service - future delivery"]
  A["AWS application operators"]

  U -->|"credentials, profile input, location, session actions"| F
  F -->|Bearer token + GraphQL over HTTPS| G
  G -->|validated HTTPS request| B
  B -->|authenticated, authorized reads/writes| M
  F -->|OAuth authorization flow| O
  O -->|identity credential| F
  B -->|notification payload, no database credential| P
  A -->|deployment/configuration access| B

  classDef boundary fill:#fff4e5,stroke:#c96,stroke-width:2px;
  classDef store fill:#eef7ee,stroke:#397a3d,stroke-width:2px;
  classDef service fill:#edf3ff,stroke:#3b6db3,stroke-width:2px;
  class F,G,B boundary;
  class M store;
  class O,P service;
```

**Trust boundaries.** User input reaches the mobile client first, but it remains untrusted until the API validates the request. The HTTPS edge between the app and API Gateway is a boundary because network traffic is outside our control. The backend-to-Atlas connection is another boundary because the API uses its database credentials and makes privileged reads and writes there. OAuth and push delivery are separate third-party boundaries; the mobile app should never hold their server secrets.

The most sensitive data is an account identity, email, authentication session/token, profile data, exact session coordinates, and participant lists. The location and participation data is especially sensitive because FieldDay is for in-person meetups. Unauthorized access could support stalking or harassment; unauthorized modification could let somebody impersonate a user, alter session membership, or manipulate ratings; denial of service could prevent people from seeing or joining a scheduled game.

## Attack tree 1: act as another FieldDay user

```mermaid
flowchart TD
  R["Goal: act as another FieldDay user"]
  R --> A["Forge a client-controlled user ID"]
  R --> B["Obtain or reuse a valid session token"]
  R --> C["Exploit an authorization gap in a resolver"]
  A --> A1["Mutation trusts userId, hostId, or raterId"]
  B --> B1["Token persists too long or is exposed"]
  C --> C1["Resolver skips current-user ownership check"]
  A1 --> X["Unauthorized write reaches MongoDB"]
  B1 --> X
  C1 --> X
```

## Attack tree 2: collect users' session location and presence data

```mermaid
flowchart TD
  R["Goal: learn where a FieldDay user will be"]
  R --> A["Read data beyond the viewer's allowed scope"]
  R --> B["Collect session data at scale"]
  R --> C["Abuse a leaked account session"]
  A --> A1["GraphQL resolver returns another user's data"]
  B --> B1["No query limits or rate controls"]
  B --> B2["Exact locations exposed too early"]
  C --> C1["Stolen device or uncleared local session"]
  A1 --> X["Location, participant, and schedule data exposed"]
  B1 --> X
  B2 --> X
  C1 --> X
```

## Planned mitigation work

- [#201: Authenticate GraphQL requests and enforce the current user](https://github.com/pkarlsso/FieldDay/issues/201) moves authority from mutable client variables to a verified request identity. The GraphQL context and resolvers must derive the current user from a valid token, then check ownership/membership for profile, session, rating, friend, and report mutations. This is preventative. Integration tests should also intentionally try cross-user reads and writes, making them detective controls.
- [#200: Google sign-in and persistent FieldDay identity](https://github.com/pkarlsso/FieldDay/issues/200) provides the sign-in flow needed to issue and retain a real FieldDay identity without committing provider secrets into the Expo app. This is preventative.
- [#212: Verify NFR-2 transport, authorization, and data protection](https://github.com/pkarlsso/FieldDay/issues/212) records evidence that HTTPS is required, protected data is denied across user boundaries, secrets stay out of Git/mobile configuration, and Atlas encryption-at-rest is enabled. This is mainly detective, with automated authorization coverage used as regression protection.
- [#218: Add user-controlled profile and location visibility](https://github.com/pkarlsso/FieldDay/issues/218) puts location/profile visibility rules in GraphQL responses and persisted settings rather than just hiding fields in the UI. This is preventative.
