# Manual Test Report: Live Home and My Sessions, End Times, No-Show Check and Session Inputs

> Ethan's verdict on the phone build was "ok it works". On 2026-11-01 he confirmed he did every step below. No screenshots were taken during these sessions.

## Test identification

- Test case IDs: MT-FR4-01, MT-FR1-04
- Requirement IDs: FR-1 (session inputs), FR-4 (rating eligibility)
- Issues:
  - [#203](https://github.com/pkarlsso/FieldDay/issues/203) live Home and My Sessions
  - [#204](https://github.com/pkarlsso/FieldDay/issues/204) session completion and attendance
  - [#205](https://github.com/pkarlsso/FieldDay/issues/205) iOS date picker warning
  - [#206](https://github.com/pkarlsso/FieldDay/issues/206) capacity and skill inputs
- Tester: Ethan Ottinger, on an iPhone
- Date: 2026-10-04, 21:10–21:19 EDT
- Build tested: the `issues-203-206` branch, based on `dev` at `b401fae`. It became [PR #244](https://github.com/pkarlsso/FieldDay/pull/244) (`24cb367`), merged as `3832d3c`.
- Environment:
  - App: iPhone with Expo Go (SDK 57) at `exp://10.0.0.19:8081`, with live data on
  - Backend: local, connected to the team's Atlas cluster

## Preconditions

1. Signed in with a real account.
2. A second account available to join sessions.

## Steps and expected results

| Step | Action | Expected result | Actual result | Pass/Fail |
| --- | --- | --- | --- | --- |
| 1 | Open Create and pick a start time. | The end time defaults to 2 hours later and moves with the start. No date-picker warning appears on iOS. | Worked as expected. The tester reported "ok it works". | Pass |
| 2 | Set an end time before the start, or more than 24 hours later. | The form refuses it. | Refused. | Pass |
| 3 | Set capacity and skill level, then create. | The session saves, and the details show capacity and skill. | Shown on the session details. | Pass |
| 4 | Open Home and My Sessions. | Real hosted, joined and ended sessions appear, not sample data. | Real sessions appeared. | Pass |
| 5 | After a session ends, open it as a participant. | The "Did anyone not show up?" screen appears. Then rating opens for players who attended. | Shown as expected. | Pass |

## Evidence

- [PR #244](https://github.com/pkarlsso/FieldDay/pull/244) and its [passing CI build](https://github.com/pkarlsso/FieldDay/actions/runs/37251348159)
- [`test:session-lifecycle`](evidence/2026-10-31-integration-tests.txt) covers input validation, end times, automatic ending, the no-show majority rule and rating eligibility. It passed on 2026-10-31.

## Defects and follow-up

- **Requirement change made during testing:** the original "host marks complete, players confirm attendance" step was replaced. Now everyone in the session is asked who didn't show up, sessions end on their own at the end time, and every session has a start and an end time.
- **Environment issue:** `dev` at the time couldn't start the backend because of the Apollo Server 5 upgrade ([#237](https://github.com/pkarlsso/FieldDay/issues/237)). Testing waited for the dependency rollback in [PR #238](https://github.com/pkarlsso/FieldDay/pull/238).
