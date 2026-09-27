import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { graphql } from '../api';
import { CURRENT_USER_ID } from '../config';

const PURPLE = '#7C7EFF';
const RED = '#E74C3C';

const MUTATION = `
  mutation ReportUser($reporterId: ID!, $input: ReportInput!) {
    reportUser(reporterId: $reporterId, input: $input) {
      success
      message
    }
  }
`;

export default function ReportUserScreen({ route, navigation }) {
  const { user } = route.params;
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for the report.');
      return;
    }

    if (reason.length > 500) {
      Alert.alert('Error', 'Reason must be 500 characters or less.');
      return;
    }

    setLoading(true);
    try {
      const data = await graphql(MUTATION, {
        reporterId: CURRENT_USER_ID,
        input: {
          reportedUserId: user.id,
          reason: reason.trim()
        }
      });

      const result = data.reportUser;
      if (result.success) {
        Alert.alert(
          'Report Submitted',
          result.message,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Report User</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.userInfoCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userLabel}>User you are reporting</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>Reason for report</Text>
          <Text style={styles.labelHint}>
            Please provide a brief explanation of why you are reporting this user.
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="Describe the issue..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={6}
            value={reason}
            onChangeText={setReason}
            maxLength={500}
          />
          <Text style={styles.charCount}>{reason.length}/500</Text>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Report</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: PURPLE, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  userInfoCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center',
    marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: PURPLE,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  userName: { fontSize: 20, fontWeight: '700', color: '#222', marginBottom: 4 },
  userLabel: { fontSize: 14, color: '#888' },
  formCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  label: { fontSize: 16, fontWeight: '600', color: '#222', marginBottom: 4 },
  labelHint: { fontSize: 13, color: '#888', marginBottom: 12 },
  textInput: {
    backgroundColor: '#F8F8F8', borderRadius: 12, padding: 14,
    fontSize: 15, color: '#222', textAlignVertical: 'top', minHeight: 120,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  charCount: { fontSize: 12, color: '#999', textAlign: 'right', marginTop: 8 },
  submitBtn: {
    backgroundColor: RED, borderRadius: 12, padding: 16, alignItems: 'center',
    marginTop: 20,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { color: '#666', fontSize: 15, fontWeight: '600' },
});
