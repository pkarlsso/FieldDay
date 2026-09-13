import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import MainTabs from './src/MainTabs';
import SignUpEmailScreen from './src/screens/auth/SignUpEmailScreen';
import SignUpPasswordScreen from './src/screens/auth/SignUpPasswordScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import TwoFactorScreen from './src/screens/auth/TwoFactorScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="SignUpEmail" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="SignUpEmail" component={SignUpEmailScreen} />
        <Stack.Screen name="SignUpPassword" component={SignUpPasswordScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="TwoFactor" component={TwoFactorScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
