# Manual Test Report: Live Roster Refresh and Social-Rating Cooldown

> **Draft:** before submitting, Ethan should confirm the rows marked **Confirm**. The test session records the setup, but not the result.

## Test identification

- Test case IDs: MT-FR8-01, MT-FR2-05
- Requirement IDs: FR-2 (roster updates), FR-8 (cooldown)
- Issues: [#207](https://github.com/pkarlsso/FieldDay/issues/207) refresh rosters across clients, [#210](https://github.com/pkarlsso/FieldDay/issues/210) social-rating cooldown
- Tester: Ethan Ottinger
- Date: 2026-10-18, 18:29–18:47 EDT
- Build tested: the `issues-207-210` branch at [`d1c31df`](https://github.com/pkarlsso/FieldDay/commit/d1c31df), [PR #278](https://github.com/pkarlsso/FieldDay/pull/278), merged on 2026-10-31
- Environment:
  - App: iPhone with Expo Go at `exp://10.0.0.19:8081`
  - Backend: local, with Socket.IO, connected to the shared database

## Steps and expected results

| Step | Action | Expected result | Actual result | Pass/Fail |
| --- | --- | --- | --- | --- |
| 1 | Open the same session on the phone and on a second client. Join from the second client. | The phone's roster and spots-left update without a manual refresh. | **Confirm** | **Confirm** |
| 2 | Give an account ratings that pull its social rating below 2.0. | A 2-day cooldown starts. | **Confirm** on the phone. `test:cooldown` covers it automatically. | **Confirm** |
| 3 | Try to create or join a session as that account. | A cooldown notice with the end time appears, and the action is refused. | **Confirm** | **Confirm** |

## Evidence

- [PR #278](https://github.com/pkarlsso/FieldDay/pull/278) and its [passing CI build](https://github.com/pkarlsso/FieldDay/actions/runs/39180812829)
- `test:realtime` and `test:cooldown`, added in PR #278, passed in the [integration test run on 2026-10-31](evidence/2026-10-31-integration-tests.txt)

## Defects and follow-up

- No defects were recorded.
- PR #278 was merged on 2026-10-31, after its conflicts with the participation limits from [#268](https://github.com/pkarlsso/FieldDay/pull/268) were resolved.
