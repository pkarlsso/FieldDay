import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from './src/screens/HomeScreen';
import RateSessionScreen from './src/screens/RateSessionScreen';
import SessionCompleteScreen from './src/screens/SessionCompleteScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: '#7C7EFF',
          tabBarInactiveTintColor: '#999',
          tabBarStyle: { paddingBottom: 8, paddingTop: 8, height: 65 },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          tabBarIcon: () => {
            if (route.name === 'Home') return <Text style={{ fontSize: 22 }}>🏠</Text>;
            if (route.name === 'Profile') return <Text style={{ fontSize: 22 }}>👤</Text>;
            return null;
          },
          tabBarButton: ['RateSession', 'SessionComplete'].includes(route.name)
            ? () => null
            : undefined,
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
        <Tab.Screen name="RateSession" component={RateSessionScreen} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="SessionComplete" component={SessionCompleteScreen} options={{ tabBarButton: () => null }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
