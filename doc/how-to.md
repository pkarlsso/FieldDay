# How-To FieldDay

This guide covers common tasks in FieldDay and tasks for working on the project. For a first-time walkthrough, see the [tutorial](tutorial.md).

## End users

### How to reset your password

**Purpose:** Get back into an account that uses an email and password.

**Before you start:** You need access to the email address on your FieldDay account and a working internet connection.

1. On the login screen, tap **Forgot your password?**
2. Enter the email address for your account and tap **Send Reset Code**.
3. Check your inbox and spam folder for the code. The app gives the same response whether or not the email belongs to an account.
4. Enter the code and a new password that meets the on-screen requirements, then tap **Reset Password**.
5. Return to login and sign in with your new password. If the code expired or did not arrive, request another one.

**Expected result:** You can sign in with your new password. Existing signed-in sessions are signed out after a successful reset.

### How to find and join a session

**Purpose:** Find a game and join its list of players.

**Before you start:** Sign in and allow location access if you want nearby results. You need a session that has room and is still open to joining.

1. Open **Explore**. Browse the list, or switch to **Map** and tap a session marker.
2. In list view, tap **Filters** to narrow results by options such as sport, distance, or skill level. Tap **Apply**.
3. Open a session to review its location, time, available spots, and details.
4. Tap **Join Session**, read the commitment message, and confirm.
5. Open **Home** to find the session under **Joined**.

**Expected result:** The session lists you as a participant and appears in your joined sessions. If it is full, closed to joining, or you are in a cooldown, the app will not let you join; choose another session or try again when the restriction ends.

### How to create a session

**Purpose:** Host a game for others to find and join.

**Before you start:** Sign in, choose a sport and location, and decide when the game will take place. Choose a start more than five minutes away so players have time to join.

1. Tap **Create** in the bottom bar.
2. Fill in the sport, location, date, start and end time, skill level, and participant limit. Select the location from the available search results when prompted.
3. Choose who can see the session and whether it should happen with whoever joins or **Only if full**.
4. Tap **Create Session**, read the commitment message, and confirm.
5. Open **Home** and look under **Hosting** to see the session.

**Expected result:** Your new session is saved and shown in Hosting. Eligible users can discover or join it based on its visibility and joining rules. For an **Only if full** session, joining closes five minutes before the start and the session is called off if it is not full.

### How to find a friend and send a request

**Purpose:** Connect with another FieldDay user.

**Before you start:** Both people need FieldDay accounts. Have the other person's name ready.

1. Open **Profile** and tap **Find & requests**, or tap the people icon in **Chat**.
2. Search for the person by name and select the right result. You can tap a name to view their profile.
3. Tap **Request** or **Add friend**. The other person can accept the request from their friends screen.
4. Check your friends list after they accept.

**Expected result:** The request shows as pending until it is accepted. Once accepted, the person appears in your friends list.

### How to message a friend or session group

**Purpose:** Coordinate with another player or the people in a session.

**Before you start:** Sign in. For a direct message, the other person must be your friend. For a session chat, join or host the session first.

1. Open **Chat** and select the conversation. To start a direct chat, open **Friends** using the people icon and select a friend.
2. Type a message in the text box and tap the send button.
3. To open a session conversation, select its session chat from the Chat list.

**Expected result:** Your message appears in the conversation. If you leave a session, its chat leaves your list; you can no longer send messages to that session chat.

### How to update FieldDay in TestFlight

**Purpose:** Install a newer beta build when the team makes one available.

**Before you start:** You need TestFlight, an accepted invitation, and access to the new build.

1. Open **TestFlight** on your iPhone and select **FieldDay Sports**.
2. Tap **Update** when a newer build is available. You do not need to uninstall the app first.
3. To install future available builds automatically, turn on **Automatic Updates** under the app's information in TestFlight.

**Expected result:** The newer build replaces the installed beta. A build must finish Apple processing and be available to your tester group first.

## Developers

### How to set up the project locally

**Purpose:** Install the frontend and backend workspaces so you can work on FieldDay.

**Before you start:** Install Git and Node.js 22 with npm. Have repository access and a local development database or a separately provisioned test database; do not use production credentials for routine testing.

1. Clone the repository and install dependencies from its root:

   ```sh
   git clone https://github.com/pkarlsso/FieldDay.git
   cd FieldDay
   npm ci
   ```

2. Copy the example configuration files:

   ```sh
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. Set `MONGODB_URI` in `backend/.env` to your development database. Keep credentials out of Git. The frontend example points at the shared API; change `EXPO_PUBLIC_API_URL` if you intend to use your local backend.
4. Run `npm run check` from the repository root to check the installation.

**Expected result:** Both workspaces are installed and the local check completes. The check does not prove that database-backed integration tests or native-device flows work.

### How to run the backend and app locally

**Purpose:** Test frontend changes against your own backend.

**Before you start:** Complete the local setup and start your development MongoDB instance. Use a simulator or phone appropriate for the feature you are testing.

1. Set `EXPO_PUBLIC_API_URL=http://127.0.0.1:4000/graphql` in `frontend/.env` for an iOS simulator on the same Mac. A physical phone needs a reachable address for your computer; its `127.0.0.1` refers to the phone itself.
2. From the repository root, start the backend:

   ```sh
   npm run start --workspace backend
   ```

3. In a second terminal, start Expo:

   ```sh
   npm run start --workspace frontend
   ```

4. Open the app in your simulator or compatible Expo client. Restart Expo after changing frontend environment variables. Native features such as iOS Google sign-in need an appropriate native build rather than Expo Go.

**Expected result:** The app sends requests to your local backend, and changes to your development database stay in that environment. Check the backend terminal and API URL if requests fail.

### How to run checks before opening a pull request

**Purpose:** Catch common errors before asking the team to review your work.

**Before you start:** Install dependencies with `npm ci` from the repository root.

1. From the repository root, run:

   ```sh
   npm run check
   npm run test:unit
   ```

2. Run relevant database-backed tests for your change when you have an isolated test database. For example, use `npm run test:chat` for chat or `npm run test:attendance` for attendance. Follow the test setup and never point test scripts at production data.
3. Open your PR and check the GitHub Actions results. Fix failures and rerun affected checks.

**Expected result:** The local checks and relevant tests pass, and GitHub Actions reports the status of the PR checks. A passing build alone does not replace testing on a phone.

### How to run the isolated multi-user simulation

**Purpose:** Exercise common flows with synthetic accounts and sessions without using the live database.

**Before you start:** Install dependencies and Docker. Use only a credential-free localhost MongoDB database whose name starts with `fieldday_sim_`.

1. Follow [Local multi-user simulation](local-simulation.md) to start its local MongoDB and Gorse containers.
2. Start the backend with the simulation database and local Gorse settings shown in that guide.
3. In another terminal, run the guide's `npm run simulate:local` command. Set `SIM_USERS` or `SIM_DELAY_MS` if you want to change the number of users or pacing.
4. Review the terminal output and, if needed, open the simulator with its frontend pointed at the local backend. Stop the local services when you are done.

**Expected result:** The script creates synthetic activity in the isolated environment and prints its results. It is a regression smoke test, not proof of real push delivery, sustained load capacity, or recommendation quality.

### How to deploy the team's backend from main

**Purpose:** Release the backend revision in `main` to the team's Elastic Beanstalk environment.

**Before you start:** The change must be reviewed and merged into `main`, and the GitHub AWS deployment role and environment must be configured. You need permission to view Actions and the AWS environment.

1. Open the repository's **Actions** tab and select **Release / Backend Deployment**. A push to `main` starts the workflow; you can also use **Run workflow** with `main` selected.
2. Open the run and check the packaging, deployment, and health-check steps.
3. In AWS Elastic Beanstalk, open `fieldday-api-prod-v2` and check the deployed version, health, events, and logs.
4. Test the particular API flow you changed. A healthy endpoint alone does not confirm email, recommendations, or every app feature.
5. If the release causes problems, follow [Backend deployment](backend-deployment.md) for rollback guidance.

**Expected result:** The workflow reports success and the environment serves the intended backend revision. The separately configured Gorse tunnel does not automatically recover from every AWS instance replacement; see issues [#384](https://github.com/pkarlsso/FieldDay/issues/384) and [#388](https://github.com/pkarlsso/FieldDay/issues/388).

### How to host your own FieldDay backend on AWS

**Purpose:** Deploy your own copy of the backend instead of using the team's AWS environment.

**Before you start:** You need an AWS account, a copy of the repository, and a MongoDB database that your AWS environment can reach. Creating an Elastic Beanstalk environment and related AWS resources can incur charges. Choose a supported Node.js platform compatible with the project; the team's backend currently uses Node.js 22.

1. Create your own MongoDB database and database user. Configure database network access so your AWS backend can connect, and keep the connection string private.
2. In the AWS Elastic Beanstalk console, create a **web server environment** using the Node.js platform. Choose your own application and environment names, region, and required IAM service role and EC2 instance profile. For the environment creation screens, see the [AWS Node.js quickstart](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/nodejs-quickstart.html).
3. Create a source bundle from the repository root. This packages the tracked contents of `backend/` at your current commit, with `package.json` at the root of the ZIP:

   ```sh
   git archive --format=zip --output=fieldday-backend.zip HEAD:backend
   ```

4. Upload and deploy that ZIP in your Elastic Beanstalk environment. In the environment's configuration, set `MONGODB_URI` to your database connection string. Use `backend/.env.example` as a guide for additional settings. Do not upload your `.env` file or commit credentials. Configure email and Google OAuth for your own accounts if you need those features; Gorse is optional and otherwise the backend uses its profile-based recommendation fallback.
5. Check the environment health and logs, then visit your deployed backend's `/health` endpoint. Configure an HTTPS endpoint for your clients, and set `EXPO_PUBLIC_API_URL` in your frontend build to that endpoint's `/graphql` path. Verify signup, login, and the other flows you need against your own services.
6. If you also want deployments from your own GitHub repository, configure a GitHub OIDC provider and a least-privilege AWS role for that repository and its `main` branch. Update `.github/workflows/deploy-backend.yml` to use your own role ARN, allowed AWS account ID, region, Elastic Beanstalk application and environment, S3 bucket, and health URL. The checked-in values refer to the FieldDay team's infrastructure and will not deploy to your account unchanged. See [GitHub's AWS OIDC setup](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws) for the trust setup.

**Expected result:** Your own Elastic Beanstalk environment runs the backend and connects to your database. Automatic GitHub deployment works only after your own role, bucket, environment, and workflow are configured and tested. This is a setup guide; a separate full deployment has not been validated as part of this documentation.

### How to check an iOS TestFlight release

**Purpose:** Check whether a built iOS app has made it through EAS and Apple processing to testers.

**Before you start:** Have access to the FieldDay Expo project and App Store Connect. The intended source revision and signing credentials must be configured.

1. Open the FieldDay project in Expo and check the iOS build and submission status.
2. Open **App Store Connect → FieldDay Sports → TestFlight → iOS** and check that the new build has finished processing.
3. Check that the build is available to the intended tester group. External testing can require Apple's beta review.
4. Install or update the build through TestFlight on a phone and test sign-in and the flows affected by your change.

**Expected result:** The intended group can access the new build and the tested flows work. See [Automatic TestFlight builds](testflight-automation.md) for the planned GitHub Actions setup and its prerequisites; check whether it has reached `main` before relying on it.
