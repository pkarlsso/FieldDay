# Version Traceability

FieldDay uses semantic versioning. The user-facing version is the `expo.version`
value in `frontend/app.json`, currently `0.1.0`, and it is kept aligned with the
frontend package version. The Settings screen reads that Expo value and shows it
to the user.

The GitHub Actions build reads the Expo version during each frontend build. It
writes `build-info.json` with the version and the Git commit SHA, then uploads an
artifact named `fieldday-bundles-<version>-<commit SHA>`. This lets the team map
a built bundle back to the exact source commit and workflow run.

The backend GraphQL endpoint is currently an internal application API. Before
we publish an external API, breaking changes will be introduced through a new
versioned endpoint or schema contract while the old contract stays available for
a documented transition period. Patch and non-breaking additions stay within the
current contract.
