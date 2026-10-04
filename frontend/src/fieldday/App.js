import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

import ExploreScreen from './screens/ExploreScreen';
import LiveExploreScreen from './screens/LiveExploreScreen';
import ChatDetailScreen from './screens/ChatDetailScreen';
import ChatScreen from './screens/ChatScreen';
import CreateSessionScreen from './screens/CreateSessionScreen';
import FriendsScreen from './screens/FriendsScreen';
import HomeScreen from './screens/HomeScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import MapScreen from './screens/MapScreen';
import RateSessionScreen from './screens/RateSessionScreen';
import SettingsScreen from './screens/SettingsScreen';
import SessionCompleteScreen from './screens/SessionCompleteScreen';
import SessionDetailsScreen from './screens/SessionDetailsScreen';
import LiveSessionDetailsScreen from './screens/LiveSessionDetailsScreen';
import SessionsScreen from './screens/SessionsScreen';
import ProfileScreen from './screens/ProfileScreen';
import { colors } from './theme';
import { restoreSession } from '../session';
import EditProfileScreen from '../screens/EditProfileScreen';
import SignUpEmailScreen from '../screens/auth/SignUpEmailScreen';
import SignUpPasswordScreen from '../screens/auth/SignUpPasswordScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import TwoFactorScreen from '../screens/auth/TwoFactorScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const useLiveData = process.env.EXPO_PUBLIC_LIVE_DATA === 'true';

const tabIcons = {
  HomeTab: 'home-variant-outline',
  Explore: 'map-search-outline',
  Map: 'map-outline',
  Sessions: 'calendar-check-outline',
  Friends: 'account-group-outline',
  Chat: 'chat-processing-outline',
  Profile: 'account-circle-outline',
  Create: 'plus-circle-outline',
};

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Explore"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.purple,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: 76,
          paddingTop: 8,
          paddingBottom: 12,
          borderTopColor: colors.line,
          backgroundColor: colors.card,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '800' },
        tabBarIcon: ({ focused }) => (
          <MaterialCommunityIcons
            name={tabIcons[route.name]}
            size={focused ? 25 : 22}
            color={focused ? colors.purple : colors.muted}
          />
        ),
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Explore" component={useLiveData ? LiveExploreScreen : ExploreScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Sessions" component={SessionsScreen} />
      <Tab.Screen name="Friends" component={FriendsScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Create" component={CreateSessionScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  // null while we check for a saved login, then the screen to open first.
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    let active = true;
    restoreSession().then((signedIn) => {
      if (active) setInitialRoute(signedIn ? 'MainTabs' : 'SignUpEmail');
    });
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
    <NavigationContainer>
      <StatusBar style="dark" />
      {/* cardStyle flex keeps each card viewport-sized on web, so screens scroll inside themselves. */}
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false, cardStyle: { flex: 1 } }}>
        <Stack.Screen name="SignUpEmail" component={SignUpEmailScreen} />
        <Stack.Screen name="SignUpPassword" component={SignUpPasswordScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="TwoFactor" component={TwoFactorScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="SessionDetails" component={useLiveData ? LiveSessionDetailsScreen : SessionDetailsScreen} />
        <Stack.Screen name="RateSession" component={RateSessionScreen} />
        <Stack.Screen name="SessionComplete" component={SessionCompleteScreen} />
        <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
