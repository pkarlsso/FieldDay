# Release and deployment status

FieldDay is available for iOS testing through TestFlight. The mobile app uses
the shared AWS API rather than requiring each tester to run a local server.
See the [tutorial](tutorial.md) for requesting access and installing the app.
TestFlight invitation and build availability depend on the tester group and,
for external testing, any required Apple beta review.

## Services and release flow

- **Backend:** The Node.js GraphQL API runs on AWS Elastic Beanstalk, behind
  API Gateway, and uses MongoDB Atlas for application data. Merges to `main`
  trigger the [backend deployment workflow](backend-deployment.md).
- **iOS:** Expo EAS builds the iOS app and submits it to App Store Connect.
  The team distributes available builds through TestFlight. The
  [iOS release guide](testflight-automation.md) has the verification steps.
- **Recommendations:** A Google Cloud VM hosts Gorse. The AWS backend uses a
  separately configured SSH tunnel to reach it and falls back to profile-based
  ranking when Gorse is unavailable.
- **Account email:** Amazon SES provides transactional email. Sending also
  depends on the configured identity, permissions, and application settings.

## Update to the previous release plan

The shared AWS API, a TestFlight build, and the GitHub-to-AWS workflow are in
place. The team now uses EAS to produce and submit a signed iOS build for
TestFlight; this differs from the earlier plan's general Expo preview-build
wording. An [automatic iOS run](https://github.com/pkarlsso/FieldDay/actions/runs/42539123965)
successfully built and uploaded version 0.1.0, build 3. Apple processing and
availability to the intended tester group must be checked in App Store Connect.

The [backend deployment run](https://github.com/pkarlsso/FieldDay/actions/runs/42542061961)
deployed commit `ecc4a684` to the team's environment. A healthy endpoint alone
does not establish that the intended version deployed or that every integration
works. [PR #411](https://github.com/pkarlsso/FieldDay/pull/411) proposes checking
the deployed version and making retry labels unique; it requires review and a
live verification after it reaches `main`.

## Remaining release work

- Verify the latest build is processed and available to the intended TestFlight
  group, then test signup, sessions, friends, chat, and maps on a real device.
- Google sign-in has used a testing audience; confirm current publication status
  and add intended Google accounts as test users when necessary. Confirm email
  verification and password recovery work for intended testers.
- Make the Gorse connection recover when the AWS instance is replaced or its
  address changes: [#388](https://github.com/pkarlsso/FieldDay/issues/388).
  Make the Google Cloud service deployment and recovery repeatable:
  [#384](https://github.com/pkarlsso/FieldDay/issues/384). The fallback keeps
  recommendations available if Gorse is unreachable.
- Complete regression, security, performance, and accessibility checks before
  final release. Existing CI and the isolated simulation do not establish that
  every real-device or hosted-service flow has been verified.

The team should assign an owner to each incomplete release task and record its
status in the deployment submission. For operational steps and rollback, see
the [backend deployment guide](backend-deployment.md).
