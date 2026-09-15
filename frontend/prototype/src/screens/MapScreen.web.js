import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Map testing is available on iOS.</Text>
      <Text style={styles.detail}>Run the native Expo app to test location permissions and map markers.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  detail: { marginTop: 10, textAlign: 'center', color: '#666' },
});
