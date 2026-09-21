# Verification Test Inventory

Last updated: 2026-09-20

| Test Case ID | Level | Description | Req. ID | Test Owner | Test ID / Tool | Automated? | CI Integrated? | Evidence Link |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| IT-FR1-01 | Integration | Creates a session through GraphQL, verifies that its ISO timestamp, host participant, and GeoJSON coordinates are returned, then cleans up the temporary records. | FR-1.1, FR-1.2 | Gabriel Ogbalor | `npm run test:integration` | Yes | Planned by 2026-09-27 after a CI-only test database is configured. | [Integration test](../../scripts/integration-session.mjs) |
| IT-FR2-01 | Integration | Joins a guest to a session, verifies duplicate joining does not change the roster, verifies the host cannot leave, then verifies guest leave removes the guest. | FR-2.1, FR-2.2 | Gabriel Ogbalor | `npm run test:integration` | Yes | Planned by 2026-09-27 after a CI-only test database is configured. | [Integration test](../../scripts/integration-session.mjs) |
| MT-FR1-03 | System | In the iOS app, create a session using a native date and time picker plus an Apple Maps address suggestion, then verify it appears in live Explore. | FR-1.1, FR-1.2 | Gabriel Ogbalor | Xcode 27 Device Hub, iPhone 18 Pro | No | No; repeat manually for each critical mobile release. | [Completed report](manual-ios-session-flow-2026-09-20.md) |
| MT-FR7-01 | System | Allow location permission, open the native Apple map, and verify stored session markers load. | FR-7.1 | Gabriel Ogbalor | Xcode 27 Device Hub, iPhone 18 Pro | No | No; device permission and Apple Map rendering require manual verification. | [Completed report](manual-ios-session-flow-2026-09-20.md) |
| MT-FR7-02 | System | Enter a partial address, choose an Apple Maps autocomplete result, then verify the address field and the create-session marker update. | FR-7.2 | Gabriel Ogbalor | Xcode 27 Device Hub, iPhone 18 Pro | No | No; native `MKLocalSearchCompleter` requires a development build. | [Completed report](manual-ios-session-flow-2026-09-20.md) |
| UT-CI-01 | Build | Install locked dependencies, run ESLint, validate backend syntax/schema, and export the Expo web, Android, and iOS bundles from a clean runner. | NFR-1.1 | Gabriel Ogbalor | GitHub Actions `Application Build` | Yes | Yes | [Build workflow](../../.github/workflows/build.yml) |

## CI plan

The integration script deliberately creates and deletes records. It is not in CI yet because CI needs an isolated MongoDB test database and a repository secret before it can safely connect. The target is 2026-09-27. The build workflow already runs lint, GraphQL/backend validation, and Expo exports in CI.
