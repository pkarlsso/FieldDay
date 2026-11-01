# Manual Test Report: Chat (Direct and Session) on Expo SDK 58

## Test identification

- Test case IDs: MT-FR10-04, MT-NFR2-06
- Requirement IDs: FR-10 (chat, as numbered in the inventory), NFR-2
- PR: [#267 chat system](https://github.com/pkarlsso/FieldDay/pull/267). The chat feature is Gustav Karlsson's; Ethan reviewed and tested it, and fixed the defects found.
- Testers: Ethan Ottinger on the phone. Claude Code (GenAI) tested with two accounts in the web preview first, and found D2 and D3 there.
- Date: 2026-10-29, 17:50–18:36 EDT
- Build tested: the `chat-system` branch at [`c463ba7`](https://github.com/pkarlsso/FieldDay/commit/c463ba7), merged as `b2d57aa`
- Environment:
  - App: iPhone with Expo Go (SDK 58) at `exp://10.0.0.19:8082`, plus the web preview with two test accounts
  - Backend: local, connected to the team's Atlas cluster

## Steps and expected results

| Step | Action | Expected result | Actual result | Pass/Fail |
| --- | --- | --- | --- | --- |
| 1 | Open the app in Expo Go. | The app starts without errors. | The phone's Expo Go needed SDK 58, so the app was upgraded. On the phone it then crashed at startup (D1). After the fix it loaded. | Fail, then Pass |
| 2 | Open the Chat tab. | Direct messages and session chats are listed separately, and each session chat shows its sport, time and place. | The tester asked for direct messages and session chats to be separated (C1). After the change: separate lists, with the session details shown. | Pass after change |
| 3 | Send a message from one account. | It appears once for the sender and live for the other account. | In the web check, the sender first saw their message twice, and conversations had no ids (D2). After the fix, it appeared once on each side. | Fail, then Pass |
| 4 | A player who left a session sends to its chat. | A clear "not in this session" style error. | In the web check, the wrong error was shown first (D3). After the fix, it was correct. | Fail, then Pass |
| 5 | Re-test steps 1–4 on the phone. | Everything works. | The tester reported "alright it works". | Pass |

## Evidence

- [PR #267](https://github.com/pkarlsso/FieldDay/pull/267) and its [passing CI build](https://github.com/pkarlsso/FieldDay/actions/runs/40967149873) for `c463ba7`
- Fix commits:
  - [`62a305e`](https://github.com/pkarlsso/FieldDay/commit/62a305e): ids, former-participant error, duplicate messages
  - [`67e41c6`](https://github.com/pkarlsso/FieldDay/commit/67e41c6): SDK 58
  - [`1da0d22`](https://github.com/pkarlsso/FieldDay/commit/1da0d22): separate chat lists
  - [`c463ba7`](https://github.com/pkarlsso/FieldDay/commit/c463ba7): startup crash

## Defects and follow-up

- **D1: startup crash in Expo Go.** "Unhandled promise rejection: TypeError: undefined is not a function". `session.js` called `logger.log`, which doesn't exist, after push-notification registration failed. Changed to `logger.warn`.
- **D2: missing ids and duplicate messages.**
  - Conversation and participant ids came back null, and the socket payload had no ids.
  - The sender's own message was added twice, once from the response and once from the socket.
  - Fixed by adding id resolvers, sending the full message shape over the socket, and removing duplicates by id.
- **D3: wrong error for a former participant.** `sendMessage` now passes `allowFormerSession` so the right message is shown.
- **C1: usability change requested during the test.** Session chats are separate from direct messages and identified by their session details.
