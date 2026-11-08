# Manual Test Report: Sign-Up, Log-In and Email 2FA

> Results marked "confirmed by the tester" were reported by Ethan on 2026-11-01. No screenshots were taken during these sessions.

## Test identification

- Test case ID: MT-FR3-01
- Requirement IDs: FR-3 (account creation), NFR-2 (password storage)
- Issues: [#11](https://github.com/pkarlsso/FieldDay/issues/11)–[#18](https://github.com/pkarlsso/FieldDay/issues/18), [#80](https://github.com/pkarlsso/FieldDay/issues/80)
- Tester: Ethan Ottinger
- Dates and times (EDT):
  - Run 1, web: 2026-09-12, 19:45–20:15
  - Run 1, phone: 2026-09-13, 15:20–15:33
  - Run 2, regression on `dev`: 2026-09-18, 18:46–18:59
- Builds tested:
  - Run 1: `ethan-week-1`, working tree later committed as [`8a6abf5`](https://github.com/pkarlsso/FieldDay/commit/8a6abf5)
  - Run 2: the same changes applied to `dev` at `cf69086`, later pushed as the `log-in-sign-up-2fa` branch in [PR #100](https://github.com/pkarlsso/FieldDay/pull/100)
- Environment: iPhone with Expo Go (SDK 57) and Chrome on Windows 11, both on the same Wi-Fi as a local backend connected to the team's MongoDB Atlas cluster

## Preconditions

1. `backend/.env` holds the Atlas `MONGODB_URI`. For run 1's phone steps it also holds SMTP settings for a dedicated Gmail sender account with an app password.
2. Start the backend with `npm start` in `backend/`, then start Expo with `npm start` in `frontend/`.
3. Sign in to the same Expo account in the Expo Go app and with `npx expo login`.
4. Use a test email address that has no FieldDay account yet.

## Steps and expected results

| Step | Action | Expected result | Actual result | Pass/Fail |
| --- | --- | --- | --- | --- |
| 1 | Enter a new email on the sign-up screen. | The email check finds no account and moves on to the password step. | It moved on to the password step and sent a code. | Pass |
| 2 | Enter a seeded user's email. | The app says an account already exists. | Confirmed by the tester: "account already exists" appeared. | Pass |
| 3 | Type weak passwords, then a strong one. | The checklist blocks weak passwords. A strong one (8+ characters with upper, lower, number and symbol) is accepted. | Confirmed by the tester: weak passwords were blocked and a strong one was accepted. | Pass |
| 4 | Submit sign-up with SMTP configured. | A 6-digit code arrives by email. | First attempt: no email arrived (see D1). After SMTP was configured, the code arrived in the inbox. | Fail, then Pass |
| 5 | Enter the emailed code. | The account is verified and the app opens. | Verified and opened. | Pass |
| 6 | Log out, then log back in with email, password and a new 2FA code. | Log-in succeeds and needs a new code. | Confirmed by the tester: logged back in after entering a new code. | Pass |
| 7 | Open the build in Expo Go on the iPhone (run 1). | The app loads on the phone. | It first failed with an SDK 54 vs Expo Go SDK 57 mismatch (see D2). After the upgrade it loaded, once Expo Go was signed in. The tester reported "it works as expected". | Fail, then Pass |
| 8 | Repeat steps 1–6 on the `dev`-based branch in Expo Go (run 2). | Same results as run 1. | The tester reported "it works". | Pass |

## Evidence

- Commit with the tested code: [`8a6abf5`](https://github.com/pkarlsso/FieldDay/commit/8a6abf5), "Implemented profile creation and 2FA and log in (tested)"
- Run 2 branch: [PR #100](https://github.com/pkarlsso/FieldDay/pull/100), whose code was merged through [PR #101](https://github.com/pkarlsso/FieldDay/pull/101)
- CI for run 2's branch:
  - [failed build](https://github.com/pkarlsso/FieldDay/actions/runs/35405906779): `package-lock.json` hadn't been updated for the new backend dependencies
  - [passing build after the fix](https://github.com/pkarlsso/FieldDay/actions/runs/35406250715)
- Automated follow-up:
  - [Unit tests](evidence/2026-10-31-unit-tests.txt) for the password-strength, Argon2id hashing and 2FA code functions used in steps 3–6
  - [`test:accounts`](evidence/2026-10-31-integration-tests.txt) covers sign-in sessions end to end

## Defects and follow-up

- **D1: the email was never sent (environment).** `backend/.env` had no SMTP settings, so `mailer.js` logged the code to the backend console instead. A dedicated Gmail sender account was set up and its app password added to `.env`. The code then arrived. No code change was needed.
- **D2: Expo Go couldn't open the project (SDK mismatch).** The App Store only offers the newest Expo Go, which supported SDK 57, while the project used SDK 54. Fixed by upgrading the project to SDK 57 ([#80](https://github.com/pkarlsso/FieldDay/issues/80)).
- **Not a defect: Expo login.** Expo Go also had to be signed in to the same Expo account as the CLI. This is a one-time setup step.
