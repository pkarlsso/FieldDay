import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const GREEN = '#2DB55D';

// Mirrors validatePasswordStrength in backend/src/utils/password.js.
export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'upper', label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { key: 'number', label: 'A number', test: (p) => /[0-9]/.test(p) },
  { key: 'special', label: 'A special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function isStrongPassword(password) {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

export default function PasswordChecklist({ password }) {
  return (
    <View style={styles.rules}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <Text key={rule.key} style={[styles.ruleText, met && styles.ruleTextMet]}>
            {met ? '✓' : '•'} {rule.label}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rules: { marginTop: 16, paddingHorizontal: 4 },
  ruleText: { fontSize: 13, color: '#888', marginBottom: 4 },
  ruleTextMet: { color: GREEN },
});
