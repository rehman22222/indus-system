import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { colors } from '@/theme/colors';

export function RoleUnsupportedScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Use Web Portal</Text>
      <Text style={styles.body}>
        {user?.role} access is managed from the web portal. This native mobile app is reserved for patient booking, tokens, prescriptions, and video visits.
      </Text>
      <Pressable onPress={signOut} style={styles.button}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  body: {
    marginTop: 12,
    lineHeight: 22,
    textAlign: 'center',
    color: colors.muted,
  },
  button: {
    marginTop: 24,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.red,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
  },
});
