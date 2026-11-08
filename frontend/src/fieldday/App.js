import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import ExploreScreen from './screens/ExploreScreen';
import LiveExploreScreen from './screens/LiveExploreScreen';
import ChatDetailScreen from './screens/ChatDetailScreen';
import ChatScreen from './screens/ChatScreen';
import CreateSessionScreen from './screens/CreateSessionScreen';
import FriendsScreen from './screens/FriendsScreen';
import HomeScreen from './screens/HomeScreen';
import LiveHomeScreen from './screens/LiveHomeScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import RateSessionScreen from './screens/RateSessionScreen';
import LiveRateSessionScreen from './screens/LiveRateSessionScreen';
import LiveNoShowScreen from './screens/LiveNoShowScreen';
import SettingsScreen from './screens/SettingsScreen';
import SessionCompleteScreen from './screens/SessionCompleteScreen';
import SessionDetailsScreen from './screens/SessionDetailsScreen';
import LiveSessionDetailsScreen from './screens/LiveSessionDetailsScreen';
import SessionsScreen from './screens/SessionsScreen';
import LiveSessionsScreen from './screens/LiveSessionsScreen';
import ProfileScreen from './screens/ProfileScreen';
import UserProfileScreen from './screens/UserProfileScreen';
import { colors } from './theme';
import { NotificationProvider } from '../notifications';
import { restoreSession, screenAfterSignIn } from '../session';
import EditProfileScreen from '../screens/EditProfileScreen';
import SignUpEmailScreen from '../screens/auth/SignUpEmailScreen';
import SignUpPasswordScreen from '../screens/auth/SignUpPasswordScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import TwoFactorScreen from '../screens/auth/TwoFactorScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const useLiveData = process.env.EXPO_PUBLIC_LIVE_DATA !== 'false';

// Five tabs (#363). Map is a List/Map switch inside Explore, My Sessions is on
// Home (with the full list a tap away), and Friends opens from Profile and
// Chat. Those are stack screens now, so links to them still work.
const tabIcons = {
  HomeTab: 'home-variant-outline',
  Explore: 'map-search-outline',
  Create: 'plus-circle-outline',
  Chat: 'chat-processing-outline',
  Profile: 'account-circle-outline',
};

const TAB_ICON_SIZE = 28;

// Height of the icons and labels, not counting the home-indicator area.
const TAB_BAR_CONTENT_HEIGHT = 68;
// A label's line height plus its gap above the icon.
const TAB_LABEL_BLOCK = 18;
// How far the tabs sit below plain centring of icon + label, which looked too
// high in the bar. Half a label block was tuned by eye on an iPhone.
const TAB_ICON_DROP = TAB_LABEL_BLOCK / 2;
// How much of the home-indicator inset the bar keeps empty. The indicator
// itself only needs the bottom ~13pt, so reserving the full ~34pt inset left
// the tabs floating at the top of a tall bar. Outer tabs are far enough in
// from the rounded screen corners that this doesn't clip them.
const HOME_INDICATOR_OVERLAP = 16;

function MainTabs() {
  // A fixed height and bottom padding put the labels inside the iPhone's
  // home-indicator area, where the screen's rounded corners clip the outer
  // tabs. Sizing from the safe-area insets keeps every tab clear of them.
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom - HOME_INDICATOR_OVERLAP, 8);
  return (
    <Tab.Navigator
      initialRouteName="Explore"
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.purple,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
          paddingTop: 0,
          paddingBottom: bottomInset,
          paddingLeft: Math.max(insets.left, 8),
          paddingRight: Math.max(insets.right, 8),
          borderTopColor: colors.line,
          backgroundColor: colors.card,
        },
        // The library pins each tab's icon and label to the top of its slot.
        // Centring the group under a small top pad sits it lower in the bar.
        tabBarItemStyle: { justifyContent: 'center', paddingVertical: 0, paddingTop: TAB_ICON_DROP },
        // The default icon box is 31x28, which crops anything larger.
        tabBarIconStyle: { width: TAB_ICON_SIZE + 6, height: TAB_ICON_SIZE + 2 },
        tabBarLabelStyle: { fontSize: 12, lineHeight: TAB_LABEL_BLOCK - 3, fontWeight: '800', marginTop: 3 },
        // One size whether selected or not, so the row doesn't jump on tap.
        tabBarIcon: ({ focused }) => (
          <MaterialCommunityIcons
            name={tabIcons[route.name]}
            size={TAB_ICON_SIZE}
            color={focused ? colors.purple : colors.muted}
          />
        ),
      })}
    >
      <Tab.Screen name="HomeTab" component={useLiveData ? LiveHomeScreen : HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Explore" component={useLiveData ? LiveExploreScreen : ExploreScreen} />
      <Tab.Screen name="Create" component={CreateSessionScreen} options={{ tabBarAccessibilityLabel: 'Create a session' }} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  // null while we check for a saved login, then the screen to open first.
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    let active = true;
    restoreSession()
      .then((signedIn) => (signedIn ? screenAfterSignIn() : 'SignUpEmail'))
      .then((route) => { if (active) setInitialRoute(route); });
    return () => { active = false; };
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.page }}>
        <ActivityIndicator size="large" color={colors.purple} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
    <NotificationProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false, cardStyle: { flex: 1 } }}>
        <Stack.Screen name="SignUpEmail" component={SignUpEmailScreen} />
        <Stack.Screen name="SignUpPassword" component={SignUpPasswordScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="TwoFactor" component={TwoFactorScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
        {/* First-run setup: the same form as Edit Profile, shown after sign-in until it is complete. */}
        <Stack.Screen name="ProfileSetup" component={EditProfileScreen} initialParams={{ onboarding: true }} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="EditSession" component={CreateSessionScreen} />
        <Stack.Screen name="SessionDetails" component={useLiveData ? LiveSessionDetailsScreen : SessionDetailsScreen} />
        <Stack.Screen name="RateSession" component={useLiveData ? LiveRateSessionScreen : RateSessionScreen} />
        <Stack.Screen name="ReportNoShows" component={LiveNoShowScreen} />
        <Stack.Screen name="SessionComplete" component={SessionCompleteScreen} />
        <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
        <Stack.Screen name="UserProfile" component={UserProfileScreen} />
        <Stack.Screen name="Sessions" component={useLiveData ? LiveSessionsScreen : SessionsScreen} />
        <Stack.Screen name="Friends" component={FriendsScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </NotificationProvider>
    </SafeAreaProvider>
  );
}
