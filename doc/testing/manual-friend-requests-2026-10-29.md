# Manual Test Report: Friend Requests

> **Draft:** before submitting, Ethan should confirm he did steps 1, 2, 4 and 5 on the phone. The session records the defect he found in step 3, and his approval to push the fix.

## Test identification

- Test case IDs: MT-FR11-01, MT-FR11-02
- Requirement IDs: FR-11 in the inventory (FR-10 Friend Management in the SDP)
- PR: [#266 friend request system](https://github.com/pkarlsso/FieldDay/pull/266). The base feature is Gustav Karlsson's; Ethan tested it and fixed the defects found.
- Testers: Ethan Ottinger on the phone. Claude Code (GenAI) reviewed the PR before the test and checked the fixes in the web preview.
- Date: 2026-10-29, 19:07–19:40 EDT. An automated regression run followed on 2026-10-31.
- Build tested: the `friend-request-system` branch at [`e4d1705`](https://github.com/pkarlsso/FieldDay/commit/e4d1705), merged as `b2fb600`
- Environment:
  - App: iPhone with Expo Go (SDK 58) at `exp://10.0.0.19:8082`, plus the web preview with two test accounts
  - Backend: local, connected to the team's Atlas cluster

## Steps and expected results

| Step | Action | Expected result | Actual result | Pass/Fail |
| --- | --- | --- | --- | --- |
| 1 | Copy your user ID on the Friends screen, and look up another user by ID. | The user is found and a **Request** button shows. A mistyped ID says "User not found". | Found, and a mistyped ID showed "User not found" (D1 was fixed before the test). | Pass |
| 2 | Send a request. | The recipient sees it under Incoming requests and gets a "New friend request" notification. | The request and the notification appeared (D2 was fixed before the test). | Pass |
| 3 | Look up your own ID. | No request can be sent to yourself. | The tester found the console error "trying to send a friend request to yourself" (D3). After the fix, "This is you" shows instead of **Request**. | Fail, then Pass |
| 4 | Accept the request as the recipient. | Both users see each other under Your friends straight away, and the requester is notified. | Updated straight away (D4 was fixed before the test). | Pass |
| 5 | Check "People from your sessions". | Players from sessions that have ended are suggested, with their photos. | **Confirm** on the phone. `test:accounts` checks that players from a session that has ended by the clock are suggested. | **Confirm** |

## Evidence

- [PR #266](https://github.com/pkarlsso/FieldDay/pull/266) and its [passing CI build](https://github.com/pkarlsso/FieldDay/actions/runs/40974721309) for `e4d1705`
- Fix commits:
  - [`c7fe423`](https://github.com/pkarlsso/FieldDay/commit/c7fe423): D1, D2, D4, D5
  - [`8086d69`](https://github.com/pkarlsso/FieldDay/commit/8086d69): test coverage
  - [`e4d1705`](https://github.com/pkarlsso/FieldDay/commit/e4d1705): D3
- [`test:accounts`, run on 2026-10-31](evidence/2026-10-31-integration-tests.txt) checks the following, and passed:
  - sending, accepting and declining a request
  - the duplicate and wrong-user checks
  - that accepted friendships are mutual and declined requests create none
  - both notifications

## Defects and follow-up

D1, D2, D4 and D5 were found in code review before the phone test. D3 was found by the tester. D6 was found by the automated rerun.

- **D1:** `findUserById` threw on a malformed ID. It now returns no user.
- **D2:** no notification was created for a request or an acceptance. Both are now sent through `createNotification`.
- **D3:** a request to yourself reached the server and logged an error. The screen now shows "This is you", "Already friends" or "Request pending" instead of **Request**.
- **D4:** the friends list didn't reload after accepting. It now reloads.
- **D5:** friend suggestions only counted sessions marked completed, and returned no photos. They now use the end time, and photos are returned.
- **D6: regression found by the automated rerun on 2026-10-31.**
  - Dependabot's Mongoose 9 upgrade ([PR #309](https://github.com/pkarlsso/FieldDay/pull/309)) broke every friend request with "next is not a function", because Mongoose 9 no longer passes `next` to `pre('save')` hooks.
  - The accounts test missed it at first: the shared logger catches errors, so the test still exited with code 0.
  - Fixed on `verification-check-1`:
    - `FriendRequest.js` no longer uses `next`.
    - The test now fails with exit code 1.
    - The test runs in CI.
