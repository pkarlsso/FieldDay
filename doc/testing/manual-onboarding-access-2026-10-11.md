# Manual Test Report: First-Run Profile Setup, Join Rules and Session Visibility

> Results marked "confirmed by the tester" were reported by Ethan on 2026-11-01. No screenshots were taken during these sessions.

## Test identification

- Test case IDs: MT-FR3-04, MT-NFR2-01
- Requirement IDs: FR-2, FR-3, NFR-2
- Issues:
  - [#194](https://github.com/pkarlsso/FieldDay/issues/194) join and leave rules
  - [#201](https://github.com/pkarlsso/FieldDay/issues/201) act only as the signed-in user
  - [#202](https://github.com/pkarlsso/FieldDay/issues/202) first-run profile setup
  - [#217](https://github.com/pkarlsso/FieldDay/issues/217) private and friends-only sessions
- Testers: Ethan Ottinger on the phone and the web. Claude Code (GenAI) ran the web check in step 3.
- Dates and times (EDT):
  - Run 1, phone: 2026-10-11, 19:06–19:40
  - Run 2, phone and web: 2026-10-16, 11:04–11:21
- Build tested: the `issues-194-201-202-217` branch, which became [PR #262](https://github.com/pkarlsso/FieldDay/pull/262) (merged as `86c5bc7`)
- Environment:
  - Run 1: iPhone with Expo Go at `exp://10.0.0.19:8182`, against a local throwaway MongoDB, with demo sign-in on
  - Run 2: iPhone with Expo Go, plus a second account on the web at `http://localhost:8081`, against the team's Atlas cluster

## Steps and expected results

| Step | Action | Expected result | Actual result | Pass/Fail |
| --- | --- | --- | --- | --- |
| 1 | Sign up a new account. | "Set up your profile" opens, and **Finish setup** says what's missing. | The setup screen opened. The tester asked for the photo to be optional (see C1). | Pass after change |
| 2 | Finish setup without a photo (after C1). | Setup finishes with a name, at least one sport and weekly availability. | Finished. | Pass |
| 3 | Create a friends-only session on the phone. | A stranger can't see it in Explore, and its link shows "Session not found". | In the web preview, a stranger couldn't see or join the session. | Pass |
| 4 | From the web account, create a public session (run 2). | It shows up on the phone account. | First attempt: the web app showed "Failed to fetch" (see D1). After the fix, the web request returned 200. | Fail, then Pass |
| 5 | Try joining your own session, a session you're already in, and a full session. | Each is refused with a clear message, and the roster doesn't change. | Confirmed by the tester: each join was refused. `test:session-membership` also covers this automatically. | Pass |

## Evidence

- [PR #262](https://github.com/pkarlsso/FieldDay/pull/262) and its [passing CI build](https://github.com/pkarlsso/FieldDay/actions/runs/38187456496)
- [Integration tests run on 2026-10-31](evidence/2026-10-31-integration-tests.txt), all passing:
  - `test:authorization` (#201)
  - `test:profile-setup` (#202)
  - `test:session-membership` (#194)
  - `test:session-visibility` (#217)
- [`sessionAccess.js` unit tests](evidence/2026-10-31-unit-tests.txt), passing

## Defects and follow-up

- **C1: requirement change from testing.** Uploading a photo is now optional at sign-up. The server and the setup screen were updated, along with `test:profile-setup`.
- **D1: "Failed to fetch" on web (configuration).** The backend only accepts browser requests from origins on its CSRF allow-list, and `http://localhost:8081` wasn't on it. Adding it to `CSRF_ALLOWED_ORIGINS` in `backend/.env` fixed it. Phones aren't affected, because the check only applies to browsers.
- **CodeQL alert found in review:** the image-type check looked up a function by name. It was replaced with an explicit `switch` in `media.js` (`75e061c`).
