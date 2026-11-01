// The Google iOS URL scheme is derived from a public OAuth client ID at build
// time. Omit the plugin when the team has not configured a client yet.
module.exports = ({ config }) => {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (!clientId) return config;
  const match = /^([a-zA-Z0-9-]+)\.apps\.googleusercontent\.com$/.exec(clientId);
  if (!match) throw new Error('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID must be an iOS Google OAuth client ID.');
  return {
    ...config,
    plugins: [
      ...(config.plugins || []),
      ['@react-native-google-signin/google-signin', {
        iosUrlScheme: `com.googleusercontent.apps.${match[1]}`,
      }],
    ],
  };
};
