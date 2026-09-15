import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

import ExploreScreen from './src/screens/ExploreScreen';
import ChatDetailScreen from './src/screens/ChatDetailScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import HomeScreen from './src/screens/HomeScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import MapScreen from './src/screens/MapScreen';
import RateSessionScreen from './src/screens/RateSessionScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SessionCompleteScreen from './src/screens/SessionCompleteScreen';
import SessionDetailsScreen from './src/screens/SessionDetailsScreen';
import SessionsScreen from './src/screens/SessionsScreen';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const tabIcons = {
  HomeTab: 'home-variant-outline',
  Explore: 'map-search-outline',
  Map: 'map-outline',
  Sessions: 'calendar-check-outline',
  Friends: 'account-group-outline',
  Profile: 'account-circle-outline',
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
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Sessions" component={SessionsScreen} />
      <Tab.Screen name="Friends" component={FriendsScreen} />
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
        <Stack.Screen name="SessionDetails" component={SessionDetailsScreen} />
        <Stack.Screen name="RateSession" component={RateSessionScreen} />
        <Stack.Screen name="SessionComplete" component={SessionCompleteScreen} />
        <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
