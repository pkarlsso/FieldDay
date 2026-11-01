# Manual Test Report: Password Reset, Stay Signed In, Google Sign-In and Profile Editing

> **Draft:** before submitting, Ethan should confirm the rows marked **Confirm**. The test session records the setup and the defects, but not a verdict for every row.

## Test identification

- Test case ID: MT-FR3-02
- Requirement IDs: FR-3, NFR-2
- Issues: [#102](https://github.com/pkarlsso/FieldDay/issues/102) forgot password, [#103](https://github.com/pkarlsso/FieldDay/issues/103) Google sign-in, [#104](https://github.com/pkarlsso/FieldDay/issues/104) persistent sign-in, [#105](https://github.com/pkarlsso/FieldDay/issues/105) profile editing, [#106](https://github.com/pkarlsso/FieldDay/issues/106) rating backend
- Tester: Ethan Ottinger
- Date: 2026-09-19, 22:12 EDT to 2026-09-20, 16:33 EDT
- Build tested: the `ethan-last-week` branch, merged as [PR #110](https://github.com/pkarlsso/FieldDay/pull/110) (`b49413f`)
- Environment:
  - App: the web build at `http://localhost:8101` in Chrome on Windows 11
  - Backend: local, connected to the team's MongoDB Atlas cluster, with real SMTP email

## Preconditions

1. `backend/.env` holds the Atlas URI and SMTP settings. For the Google step it also needs the Google web client ID.
2. Start the backend, then serve the web build.

## Steps and expected results

| Step | Action | Expected result | Actual result | Pass/Fail |
| --- | --- | --- | --- | --- |
| 1 | Open the app and sign up. | Sign-up reaches the real backend and emails a 2FA code. | First attempt: the app wasn't using the real backend, and no email was sent (see D1). After the fix, the code arrived by email. | Fail, then Pass |
| 2 | Log out, choose **Forgot password**, and enter the emailed reset code with a new password. | The password changes, and the old one stops working. | **Confirm** | **Confirm** |
| 3 | Close and reopen the app. | The user is still signed in (30-day session). | **Confirm** | **Confirm** |
| 4 | Edit name, bio and sports on Edit Profile, then save. | The changes show on Profile and are still there after a reload. | **Confirm** | **Confirm** |
| 5 | Click **Continue with Google** on web. | Google's sign-in popup opens; after signing in, Home opens. | The button appeared once the web client ID was set. Logging in required publishing the OAuth consent screen. **Confirm** the result. | **Confirm** |
| 6 | Open Expo Go on the phone. | Google is hidden on the phone, and email sign-in works. | Expected by design: Google rejects Expo Go's `exp://` return address, so the button hides itself on phones. | Pass (by design) |

## Evidence

- [PR #110](https://github.com/pkarlsso/FieldDay/pull/110) with the tested code
- [`test:accounts`](evidence/2026-10-31-integration-tests.txt) covers the same features automatically: password reset, Google sign-in with a stubbed Google, persistent sessions, profile editing and ratings. It passed on 2026-10-31.

## Defects and follow-up

- **D1: the test build had no backend config (environment).** The fresh clone had no `backend/.env`, so the backend used a throwaway database and only logged email codes. Copying the team `.env` (Atlas URI and SMTP) fixed it. No code change was needed.
- **Follow-up:** Google sign-in can't work in Expo Go. It needs a development build with iOS and Android client IDs.
