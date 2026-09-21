import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

import ExploreScreen from './screens/ExploreScreen';
import LiveExploreScreen from './screens/LiveExploreScreen';
import ChatDetailScreen from './screens/ChatDetailScreen';
import CreateSessionScreen from './screens/CreateSessionScreen';
import FriendsScreen from './screens/FriendsScreen';
import HomeScreen from './screens/HomeScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import ProfileScreen from './screens/ProfileScreen';
import MapScreen from './screens/MapScreen';
import RateSessionScreen from './screens/RateSessionScreen';
import SettingsScreen from './screens/SettingsScreen';
import SessionCompleteScreen from './screens/SessionCompleteScreen';
import SessionDetailsScreen from './screens/SessionDetailsScreen';
import LiveSessionDetailsScreen from './screens/LiveSessionDetailsScreen';
import SessionsScreen from './screens/SessionsScreen';
import { colors } from './theme';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const useLiveData = process.env.EXPO_PUBLIC_LIVE_DATA === 'true';

const tabIcons = {
  HomeTab: 'home-variant-outline',
  Explore: 'map-search-outline',
  Map: 'map-outline',
  Sessions: 'calendar-check-outline',
  Friends: 'account-group-outline',
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
      <Tab.Screen name="Create" component={CreateSessionScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
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
