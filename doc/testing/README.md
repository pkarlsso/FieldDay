# FieldDay Verification Evidence

This directory keeps the verification records that support the FieldDay software development plan. It lives in `doc/testing` because the records describe verification across the mobile frontend, GraphQL backend, and CI workflow.

- [Verification test inventory](verification-test-inventory.md) lists each requirement, its test, owner, automation status, CI plan, and evidence.
- [Manual test template](manual-test-template.md) is used whenever a person tests a critical workflow or records a defect.
- [Manual iOS session-flow report](manual-ios-session-flow-2026-09-20.md) records the first completed Device Hub test.
- [Root cause analysis tracker](root-cause-analysis.md) links defects that require a documented RCA.

The GitHub Actions build workflow is [`.github/workflows/build.yml`](../../.github/workflows/build.yml). It installs the locked dependencies and runs lint, backend validation, and Expo exports on a fresh GitHub-hosted Ubuntu runner.
