# iOS map testing

The prototype includes a Map tab with two demo session markers and a user location indicator. iOS uses the native Apple map by default so the simulator can test the location permission and marker flow without a Google key.

To enable the Google provider in an iOS native build, set `EXPO_PUBLIC_MAP_PROVIDER=google` in a local frontend environment file and add the Google Maps iOS key through the native Expo configuration. Do not commit the key. The web build uses a text fallback because the map package is native only.

Run `npm run lint` and `npm run build` from the repository root. Then run `npm run ios` from `frontend`, allow location access, and confirm the map and markers appear. The local machine used to prepare this PR does not have Apple's `simctl` tool installed, so simulator verification remains a manual team check.

This PR addresses issue #30 and provides the map foundation for issue #28. The markers are still mock data; connecting them to discovery results is a later backend integration task.
