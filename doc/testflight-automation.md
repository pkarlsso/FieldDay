# Automatic TestFlight builds

After this workflow is merged into main, each push to main starts an iOS EAS
production build and queues it for TestFlight submission. It does not publish
the app to the App Store. Builds can also be started using Actions > Release /
iOS TestFlight > Run workflow. Builds use the checked-out commit; the run and
EAS dashboard identify that revision. Runs share a concurrency group so two
releases do not race. GitHub may replace a pending run with a newer pending run.

Before enabling the workflow:

1. Create an Expo access token with access to `@gogbalor/fieldday` and add it
   as the repository Actions secret `EXPO_TOKEN`. Never commit the token.
2. Ensure EAS has the existing distribution certificate, provisioning profile,
   and App Store Connect API key for `com.gogbalor.fieldday` and app ID
   `6829567623`. EAS must be able to submit noninteractively.
3. Initialize the remote iOS build number to at least the highest build number
   already uploaded for version 0.1.0 using `eas build:version:set` in
   `frontend`. Remote auto-increment supplies unique build numbers thereafter.
4. Confirm the production Google client IDs and API URL are correct, and that
   the latest `dev` configuration has been merged into `main`.

Check the GitHub Actions run, the EAS build/submission, and App Store Connect
processing separately. An upload does not establish external beta review or
tester availability. Each push consumes EAS build capacity and may incur
charges once included capacity is exhausted. Revert a problematic commit and
push the revert to main to create a replacement build; a TestFlight build
already distributed remains available until managed in App Store Connect.
