# Local multi-user simulation

This creates synthetic accounts and activity for testing FieldDay. It is not a production load test. It only accepts a credential-free localhost MongoDB URI whose database name begins with `fieldday_sim_`; it will refuse remote databases and a remote Gorse URL. It never deletes data. Every run adds a new uniquely named set of test data; Gorse keeps its own persistent data too. Never point a real app or real users at this test instance.

From the repository root, with Docker running and dependencies installed:

```sh
docker run -d --name fieldday-simulation-mongo -p 127.0.0.1:27028:27017 mongo:6.0
docker compose -f backend/docker-compose.gorse.yml up -d
```

If a local test MongoDB is already listening on port 27028, reuse it instead of creating another container. Start a backend connected to the simulation database in a separate terminal:

```sh
MONGODB_URI=mongodb://127.0.0.1:27028/fieldday_sim_demo \
PORT=4012 GORSE_BASE_URL=http://127.0.0.1:8088 \
GORSE_ID_SECRET=fieldday-local-test DISABLE_NO_SHOW_RATINGS_JOB=true \
npm run start --workspace backend
```

Then run the activity in another terminal:

```sh
MONGODB_URI=mongodb://127.0.0.1:27028/fieldday_sim_demo \
GORSE_BASE_URL=http://127.0.0.1:8088 GORSE_ID_SECRET=fieldday-local-test \
SIM_API_URL=http://127.0.0.1:4012/graphql SIM_DELAY_MS=250 \
npm run simulate:local
```

By default it creates 30 users and 30 sessions; set `SIM_USERS` to 4–100 and `SIM_DELAY_MS` to 0–10000 to change the size and visible pacing. The output shows a unique run ID. It exercises signup and verification with a stubbed email sender, profiles, session creation, joins, nearby sport-filtered discovery, friend requests and acceptances, an in-app notification, and one rating. For the rating, it moves one session into the past and records synthetic check-ins directly in the isolated database. It compares recommendation results before and after activity and checks Gorse join feedback. The optional HTTP check sends one authenticated request per user concurrently to the local backend; it is a basic smoke check, not sustained stress testing.

The account for player 1 is `<run-id>-0@example.test` and the local-only password is `FielddayLocalTest!2026`. Log in using a frontend configured with `EXPO_PUBLIC_API_URL=http://127.0.0.1:4012/graphql` in an iOS simulator. With local SMTP unconfigured, the backend logs the test verification code in `logs/combined.log`. These are disposable credentials and the log contains verification codes; do not use this approach with real accounts or enable it in production. The simulator uses the Mac's localhost; a physical phone needs an appropriately configured local network address and is not covered by this localhost-only setup.

Push delivery and one-hour session reminders are not demonstrated by this simulation. A ranking that stays the same is not proof of a trained model; test Gorse training and ranking quality over time with varied interactions separately. This environment does not alter AWS or the team's live MongoDB database.

## GitHub Actions

The synthetic simulation also runs in `.github/workflows/local-simulation.yml` on pull requests targeting `dev` or `main`, pushes to those branches, and manual dispatch. GitHub hosts an isolated MongoDB service, Gorse container and backend for each job. The runner and synthetic data are discarded after the job. Its 30 simultaneous requests are a regression smoke check, not a production stress or physical-device test.
