# Expanded frontend prototype

The expanded UI from the local SDP prototype is available as an opt-in demo. The existing API-backed app remains the default and its screens remain under `frontend/src/screens/`.

## Run locally

Use Node.js 22. From `frontend/`, run `npm ci`, then `npm run demo` for Expo Go or `npm run demo:web` for a browser preview. Clear Metro when switching modes (`npm run demo -- --clear` or `npm start -- --clear`) so cached transforms do not retain the previous mode. Run `npm start` without `EXPO_PUBLIC_PROTOTYPE_MODE=true` to use the existing app. The demo needs no MongoDB credentials.

`App.js` chooses between `LiveApp.js` and `prototype/App.js`. The prototype contains its own screens, shared UI, theme, and mock fixtures so integration can proceed without replacing working API calls. Asset files and the frontend dependency lockfile are tracked.

## Issue mapping and limits

| Existing issue | Prototype contribution | Still required |
| --- | --- | --- |
| #28 discovery screen | Explore UI and sport selection | Real API, radius/skill filters and remote loading/error states |
| #29 session details/joining | Details, roster and local join/leave interaction | joinSession mutation, capacity/expiry checks and persistence |
| #30 interactive map | Illustrated map and selectable mock sessions | Google Maps, device location and actual coordinates |
| #43 post-session rating | Rating/report/friend UI and completion summary | Persist ratings, reports and friend requests through the backend |
| #44 recommendations | Recommended sessions presentation | Actual recommendation retrieval and refresh |

Home, profile, settings, friends, chat, and notifications are also included for navigation review. Mock chat and session interactions do not persist to MongoDB. Some controls are visual placeholders. This import does not implement the session creation form (#27), timestamps/GeoJSON (#22–23), backend operations (#24–26), or integration tests (#31). These issues stay open.

The backend source and package manifest were compared with the prototype and are unchanged. Do not copy prototype `.env` files into Git. Native device verification and live API integration remain separate from browser demo verification.
