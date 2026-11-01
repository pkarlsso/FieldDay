# Manual Test Report: Log-In in the Main App, Profile Photo and Unsaved-Changes Prompt

> Results marked "confirmed by the tester" were reported by Ethan on 2026-11-01. No screenshots were taken during these sessions.

## Test identification

- Test case ID: MT-FR3-03
- Requirement IDs: FR-3
- Issues: [#161](https://github.com/pkarlsso/FieldDay/issues/161) profile picture, [#162](https://github.com/pkarlsso/FieldDay/issues/162) log-in and edit profile in the main app, [#178](https://github.com/pkarlsso/FieldDay/issues/178) save profile before exiting
- Testers: Ethan Ottinger on the phone. Claude Code (GenAI) ran the web checks.
- Date: 2026-09-26, 20:20–21:40 EDT
- Build tested: `feat/restore-login-and-profile`, merged as [PR #167](https://github.com/pkarlsso/FieldDay/pull/167) (`37aa289`)
- Environment:
  - App: the Expo web preview, and an iPhone with Expo Go (SDK 57) at `exp://10.0.0.19:8081`
  - Backend: local, connected to the team's Atlas cluster

## Preconditions

1. An existing FieldDay account.
2. The backend and Metro are running, and the phone is on the same Wi-Fi as the PC.

## Steps and expected results

| Step | Action | Expected result | Actual result | Pass/Fail |
| --- | --- | --- | --- | --- |
| 1 | Launch the app while signed out. | The sign-up screen opens, not the Explore tab. | The Create Account screen opened, and **Log In** went to the log-in screen. | Pass |
| 2 | Log in and open Home and Profile. | The greeting, avatar, sports and rating show the real account, not the "Alex" sample user. | Home said "Welcome back, Gugs" with that account's sports count and initials. | Pass |
| 3 | On Edit Profile, add a 1200×800 photo. | It's cropped to a centered 256×256 image and previewed. | A 256×256 image of about 4 KB was previewed correctly. | Pass |
| 4 | Open Edit Profile, change nothing, and press back. | It leaves with no prompt. | It left straight away. | Pass |
| 5 | Edit the bio, then press back. | A "Save your changes?" prompt appears. | The prompt appeared. | Pass |
| 6 | Choose **Keep editing**. | Stays on the screen with the edit intact. | Stayed, and the text was kept. | Pass |
| 7 | Press back again and choose **Discard changes**. | Returns to Profile with the bio unchanged. | Returned with the bio unchanged. | Pass |
| 8 | Repeat steps 1–7 on the iPhone in Expo Go, and save a real photo. | Same behaviour on iOS. The saved photo shows on Profile and in the Home header. | Confirmed by the tester: on the iPhone, a photo was added and saved, and the "Save your changes?" prompt appeared. | Pass |

## Evidence

- [PR #167](https://github.com/pkarlsso/FieldDay/pull/167) and its [passing CI build](https://github.com/pkarlsso/FieldDay/actions/runs/36286075172)
- [`test:profile-setup`](evidence/2026-10-31-integration-tests.txt) covers photo upload, replacement and removal, and the [`media.js` unit tests](evidence/2026-10-31-unit-tests.txt) cover photo validation. Both passed on 2026-10-31.

## Defects and follow-up

- **Found during the test:** the log-in flow didn't run at all on `dev`. The app's entry point had been switched to the tab app, and the old `LiveApp.js` with the log-in flow was no longer imported. Fixed in this PR by moving the log-in flow into `src/fieldday/App.js`.
- **Cleanup mistake, caught before commit:** three of Ethan's screens (Home, Rate Session, Session Complete) were deleted as unused and then restored after review.
