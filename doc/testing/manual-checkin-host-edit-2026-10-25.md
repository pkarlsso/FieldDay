# Manual Test Report: Location Check-In, No-Show Ratings and Host Edit/Cancel

## Test identification

- Test case IDs: MT-FR9-05, MT-FR9-06, MT-FR1-05
- Requirement IDs: FR-9 Session Attendance Confirmation (SDP numbering), FR-1
- Issues: [#279](https://github.com/pkarlsso/FieldDay/issues/279) location check-in, [#280](https://github.com/pkarlsso/FieldDay/issues/280) automatic rating of 1 for no-shows, [#281](https://github.com/pkarlsso/FieldDay/issues/281) host edit and cancel
- Tester: Ethan Ottinger
- Date: 2026-10-25, 20:17–20:52 EDT
- Build tested: the `issues-279-281` branch at [`4fc1c36`](https://github.com/pkarlsso/FieldDay/commit/4fc1c36), [PR #296](https://github.com/pkarlsso/FieldDay/pull/296), merged on 2026-10-31
- Environment:
  - App: iPhone with Expo Go (SDK 58) at `exp://10.0.0.19:8082`, plus the web preview
  - Backend: local, connected to the team's Atlas cluster, with the automatic no-show rating job switched off for the run (`DISABLE_NO_SHOW_JOB`)

## Steps and expected results

| Step | Action | Expected result | Actual result | Pass/Fail |
| --- | --- | --- | --- | --- |
| 1 | Open the app in Expo Go. | It loads on SDK 58. | The phone's Expo Go needed SDK 58. The app loaded after the SDK 58 upgrade in this PR. | Pass |
| 2 | Log in with an account from the previous week. | The account exists and log-in works. | First attempt failed, because the test backend used an empty local database (see D1). After switching to Atlas, the accounts were found. | Fail, then Pass |
| 3 | During a session's first 10 minutes, within 200 m, tap **Check in**. | The check-in is recorded. | The tester reported testing the new features by hand ("i tested these functionalities manually as well"). | Pass |
| 4 | As host, edit a session's time and capacity. | The changes save. Capacity can't go below the number of players already in it. | Same as step 3. | Pass |
| 5 | As host, cancel a session. | It shows **Cancelled** for the players in it, and it can't be joined. | Same as step 3. | Pass |

## Evidence

- [PR #296](https://github.com/pkarlsso/FieldDay/pull/296) and its [passing CI build](https://github.com/pkarlsso/FieldDay/actions/runs/40251100226). The PR description records the manual test.
- `test:attendance`, added in PR #296, covers the check-in window and radius, automatic ratings for no-shows, and host edit and cancel. It passed in the [integration test run on 2026-10-31](evidence/2026-10-31-integration-tests.txt).

## Defects and follow-up

- **D1: the test backend used the wrong database (environment).** The first test backend used a local throwaway database, so earlier accounts and passwords were missing. It was switched to Atlas, with the no-show rating job disabled so real teammates wouldn't be given ratings of 1 for old sessions.
- **Follow-up (before deploying):** once deployed, the no-show job will also apply to past sessions. The PR description flags this.
