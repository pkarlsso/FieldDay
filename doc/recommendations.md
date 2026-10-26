# Session recommendations

FieldDay now has a server-side fallback recommender that does not depend on Shaped or another paid service. The authenticated GraphQL query is `recommendedSessions(origin, maxDistanceMiles, limit)`.

The query returns only future, upcoming sessions that still have room and that the signed-in user is allowed to see. It leaves out sessions the user hosts or has already joined. The backend ranks those candidates using the user's sport preferences and per-sport skill, the session's skill band, optional distance from the device location, open spots, and how soon the session starts. Each result includes a score and plain-language reasons so the ranking is inspectable. The Explore screen shows the top five above the normal filtered session list.

The deterministic profile ranking is the cold-start fallback. An optional self-hosted Gorse service can add collaborative ranking as join and recommendation-view signals accumulate. It is not a large language model; it learns from user/session interactions and session categories. New users still get the profile-based ranking until Gorse has enough useful activity.

## Local Gorse setup

Install Docker Desktop, then from the repository root run:

```sh
docker compose -f backend/docker-compose.gorse.yml up -d
```

Set these in `backend/.env` (copy the file from `.env.example` if needed):

```dotenv
GORSE_BASE_URL=http://127.0.0.1:8088
GORSE_ID_SECRET=<a stable random secret generated locally>
GORSE_API_KEY=
```

Generate the ID secret locally with `openssl rand -hex 32`. Keep it stable: changing it makes Gorse treat existing users and sessions as new IDs. The local Compose stack uses its own MongoDB database and an internal Docker network; MongoDB has no published host port, and Gorse's HTTP port is bound to localhost only. This is a development setup, not an internet-facing deployment.

To import existing app data once, run `npm run sync:gorse --workspace backend`. It sends only sport preferences and minimal session attributes to Gorse. IDs are HMAC pseudonyms. It does not send passwords, email addresses, names, precise session addresses, coordinates, OAuth tokens, or auth-session tokens. Historical `join` signals are backfilled only where a participant submitted a rating, which is evidence of attendance; a participant list alone is not treated as proof that they attended.

After that import, the backend sends session metadata when a session is created, records a `join` signal after a successful join, updates sport labels when a profile changes, and records a `read` signal for shown recommendations. MongoDB remains the source of truth. If Gorse is unavailable or returns no usable ranking, the request uses the deterministic profile fallback.

## Production security and operations

Gorse adds a service that must be secured; self-hosting does not automatically make it risk-free. Do not expose its REST API or dashboard to the public internet. Put it on a private network reachable only by the backend. For remote Gorse, use HTTPS, set an API key, and store that key plus the stable `GORSE_ID_SECRET` in backend-side AWS Secrets Manager/environment configuration. Do not put them in the mobile app, frontend environment, repository, or chat. Use a separate, least-privilege Gorse database user/database rather than FieldDay's application database credentials. The API key is required for Gorse's REST API when enabled, and Gorse documents it as requiring SSL.

The repository includes a local Compose configuration only. It does not provision or deploy Gorse to AWS. Production still needs a private Gorse host, TLS termination, persistent storage/backup decisions, secret configuration, and a deployment/restart plan. Keep the existing fallback until that environment is deployed and verified. The current profile model also stores availability without a timezone, so time-of-day availability is intentionally not used for ranking yet.

The maximum query radius is 250 miles and the result limit is 20. If location permission is unavailable, the app still returns recommendations using the profile and session data without distance scoring.
