# Manual Test Report: iOS Session and Map Flow

## Test identification

- Test case IDs: MT-FR1-03, MT-FR7-01, MT-FR7-02
- Requirement IDs: FR-1.1, FR-1.2, FR-7.1, FR-7.2
- Tester: Gabriel Ogbalor
- Date: 2026-09-20
- Build tested: local development build from the `backend-integration-tests` branch plus the iOS compatibility and frontend-promotion changes
- Environment: Xcode 27, Device Hub, iPhone 18 Pro simulator, local GraphQL server, MongoDB Atlas

## Preconditions

1. Start the backend with `npm start --workspace backend`.
2. Start Metro with `npx expo start --dev-client --localhost` from `frontend`.
3. Install the iOS development build and launch it in Device Hub.
4. Use a local `frontend/.env` with `EXPO_PUBLIC_LIVE_DATA=true`, a valid seeded user ID, and a local simulator API URL. No `.env` file is committed.

## Results

| Step | Action | Expected result | Actual result | Pass/Fail |
| --- | --- | --- | --- | --- |
| 1 | Launch the normal app. | The real FieldDay app opens instead of the legacy two-tab app. | Seven tabs loaded: Home, Explore, Map, Sessions, Friends, Create, and Profile. | Pass |
| 2 | Open Map and allow location access. | Apple map loads and stored sessions render as markers. | Permission prompt appeared; after allowing, Apple map loaded with two session pins. | Pass |
| 3 | Open Create and type `Station 21 West Lafayette`. | Address suggestions are returned. | Apple Maps suggestions appeared in the iOS create screen. | Pass |
| 4 | Select an address suggestion. | The selected address populates the field and the map marker follows it. | The selected full address populated the field and the create map retained a marker for the selected location. | Pass |
| 5 | Create a Pickleball session. | The backend persists the session and live Explore shows it. | The request completed and live Explore displayed the created Pickleball session with its location, timestamp, and participant count. | Pass |

## Evidence

- [iOS path and Xcode defect issue](https://github.com/pkarlsso/FieldDay/issues/126)
- [iOS compatibility PR](https://github.com/pkarlsso/FieldDay/pull/127)
- [Frontend promotion PR](https://github.com/pkarlsso/FieldDay/pull/128)

## Defects and follow-up

The test exposed the iOS build-path and Xcode 27 scene-lifecycle defect recorded in [issue #126](https://github.com/pkarlsso/FieldDay/issues/126). Its root cause, fix verification, and regression prevention are documented in that issue. The integration test still needs a CI-only MongoDB database before it can run in GitHub Actions.
