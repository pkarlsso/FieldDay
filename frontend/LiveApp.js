import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import MainTabs from './src/MainTabs';
import { restoreSession } from './src/session';
import SignUpEmailScreen from './src/screens/auth/SignUpEmailScreen';
import SignUpPasswordScreen from './src/screens/auth/SignUpPasswordScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import TwoFactorScreen from './src/screens/auth/TwoFactorScreen';
import ForgotPasswordScreen from './src/screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/auth/ResetPasswordScreen';

const Stack = createStackNavigator();

export default function App() {
  // null while we check for a saved login, then the screen to open first.
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    let active = true;
    restoreSession().then((signedIn) => {
      if (active) setInitialRoute(signedIn ? 'Main' : 'SignUpEmail');
    });
    return () => { active = false; };
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' }}>
        <ActivityIndicator size="large" color="#7C7EFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="SignUpEmail" component={SignUpEmailScreen} />
        <Stack.Screen name="SignUpPassword" component={SignUpPasswordScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="TwoFactor" component={TwoFactorScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
