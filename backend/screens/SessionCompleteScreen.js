import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const PURPLE = '#7C7EFF';
const GREEN = '#2DB55D';
const BLUE = '#3366E6';

export default function SessionCompleteScreen({ route, navigation }) {
  const { avgRatingGiven, friendRequestsSent, playersRated } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Session Complete</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <Text style={styles.title}>Session Complete!</Text>
        <View style={styles.statsCard}>
          <Text style={styles.statLine}>
            You rated <Text style={styles.statBold}>{playersRated} players</Text>
          </Text>
          <Text style={styles.statLine}>
            Avg. rating given: <Text style={styles.statBold}>{avgRatingGiven}</Text>
          </Text>
          <Text style={styles.statLine}>
            Friend requests sent: <Text style={styles.statBold}>{friendRequestsSent}</Text>
          </Text>
        </View>
        <TouchableOpacity style={styles.shareBtn}>
          <Text style={styles.shareBtnText}>Share Session</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: PURPLE, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  content: { flex: 1, alignItems: 'center', paddingTop: 40 },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: GREEN,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  checkMark: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  title: { fontSize: 26, fontWeight: '700', color: '#222', marginBottom: 24 },
  statsCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 20, width: '85%',
    marginBottom: 30, borderWidth: 1, borderColor: '#eee',
  },
  statLine: { fontSize: 15, color: '#444', marginBottom: 8, textAlign: 'center' },
  statBold: { fontWeight: '700', color: '#222' },
  shareBtn: {
    backgroundColor: BLUE, borderRadius: 12, paddingVertical: 16,
    width: '75%', alignItems: 'center', marginBottom: 14,
  },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  doneBtn: {
    backgroundColor: '#DDD', borderRadius: 12, paddingVertical: 16,
    width: '75%', alignItems: 'center',
  },
  doneBtnText: { color: '#555', fontSize: 16, fontWeight: '600' },
});
