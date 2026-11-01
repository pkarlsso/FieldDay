# iOS builds and team testing

The repository includes an Expo development client and EAS profiles. These files prepare a build; they do not enroll an Apple account, create a project, or publish an app. The existing `com.anonymous.frontend` bundle identifier is a placeholder. Before building for a shared team or TestFlight, the team must choose an available permanent bundle identifier, connect the correct Expo/EAS project, and configure Apple signing and public frontend environment variables for that project.

From `frontend/`, after the team has configured its accounts and bundle ID:

```sh
npx eas-cli@latest build --platform ios --profile development
npx expo start --dev-client
```

An installed development build connects to Metro while developing. The `preview` profile builds an internally distributed app with bundled JavaScript; physical-device internal distribution requires suitable signing and registered devices. The `production` profile creates an App Store distribution build, which can be uploaded to App Store Connect for TestFlight before any public App Store release. Apple Developer membership and signing are required for EAS builds installed on physical iPhones. Check the EAS plan and Apple enrollment terms before starting a cloud build.

## Google sign-in

The app already contains an Expo AuthSession button and backend ID-token verification. The button is hidden until the platform's `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` is set. The backend also needs matching allowed audiences in `GOOGLE_CLIENT_IDS`. These client IDs are identifiers, not client secrets. Never put a Google client secret in the app or repository.

Native iOS Google sign-in is **not yet verified**. Choose the shared Google Cloud project and final iOS bundle identifier first; configure its OAuth consent screen and appropriate iOS/web clients. Then implement or validate the native redirect flow against Google's current iOS requirements and test a real sign-in on a signed physical-device build. Do not assume the existing `fieldday://` scheme or simulator test proves Google login works. Expo Go is not an adequate native OAuth test.

Adding Google login can trigger Apple App Review guideline 4.8, which calls for an equivalent privacy-preserving login option unless an exception applies. Review Sign in with Apple and account deletion requirements before public submission. For team testing, prefer TestFlight and distinguish internal from external tester requirements.

References: https://docs.expo.dev/guides/google-authentication/ and https://developer.apple.com/app-store/review/guidelines/.
