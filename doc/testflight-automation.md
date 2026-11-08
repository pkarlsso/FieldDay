# Automatic TestFlight builds

After this workflow is merged into main, each push to main starts an iOS EAS
production build and queues it for TestFlight submission. It does not publish
the app to the App Store. Builds can also be started using Actions > Release /
iOS TestFlight > Run workflow. Builds use the checked-out commit; the run and
EAS dashboard identify that revision. Runs share a concurrency group so two
releases do not race. GitHub may replace a pending run with a newer pending run.

Setup status and checks before relying on the workflow:

1. The repository Actions secret `EXPO_TOKEN` authenticated as `gogbalor` in a
   PR-only Actions check. Never commit the token.
2. EAS has a distribution certificate, active provisioning profile, and App
   Store Connect API key for `com.gogbalor.fieldday` and app ID `6829567623`.
   A fresh end-to-end submission is still needed to verify the key with Apple.
3. As of November 8, 2026, the remote iOS build number is initialized to `1`,
   matching the latest uploaded build in App Store Connect. Remote
   auto-increment supplies unique build numbers thereafter.
4. Confirm the production Google client IDs and API URL are correct, and that
   the latest `dev` configuration has been merged into `main`.

Check the GitHub Actions run, the EAS build/submission, and App Store Connect
processing separately. An upload does not establish external beta review or
tester availability. Each push consumes EAS build capacity and may incur
charges once included capacity is exhausted. Revert a problematic commit and
push the revert to main to create a replacement build; a TestFlight build
already distributed remains available until managed in App Store Connect.
