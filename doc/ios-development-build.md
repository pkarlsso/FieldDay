# iOS development build

FieldDay already uses the custom `fieldday://` app scheme and `expo-auth-session` for Google OAuth. Expo Go cannot use the app's custom OAuth redirect, so test Google login in the installed development client instead.

## One-time setup

1. Use the shared Expo account: `npx eas-cli@latest login`.
2. Enable Developer Mode on the iPhone.
3. Register the phone: `npx eas-cli@latest device:create`.
4. Create the iOS OAuth client in Google Cloud Console using the exact bundle identifier from `frontend/app.json`. Put its client ID in `frontend/.env` as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and put the same client ID in the backend `GOOGLE_CLIENT_IDS` configuration.

## Build and install

From the repository root:

```bash
npx eas-cli@latest build --platform ios --profile development
```

Open the completed EAS build link on the registered iPhone and install the build. Start Metro while developing:

```bash
cd frontend
npx expo start --dev-client
```

Open FieldDay on the iPhone, select the development server, and use the sign-in screen. The installed client receives the `fieldday://` redirect after Google login. Metro only serves JavaScript while you are actively developing.

For a demo that does not need Metro, create the `preview` profile build after pointing the app at the shared AWS API.
