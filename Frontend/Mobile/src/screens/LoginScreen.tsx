import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { env } from '@/config/env';
import { useAuth } from '@/auth/AuthContext';
import { colors } from '@/theme/colors';

const demoAccounts = [
  { label: 'Patient', email: 'patient1@example.com' },
  { label: 'Video Demo', email: 'video.patient1@example.com' },
];

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('patient1@example.com');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    try {
      setLoading(true);
      await signIn(email, password);
    } catch (error) {
      Alert.alert('Login failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>IH</Text>
      </View>
      <Text style={styles.title}>{env.appName}</Text>
      <Text style={styles.subtitle}>Patient appointments, tokens, prescriptions, and video visits</Text>

      <View style={styles.panel}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="email@example.com"
          style={styles.input}
          value={email}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          style={styles.input}
          value={password}
        />

        <Pressable disabled={loading} onPress={handleLogin} style={styles.button}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </Pressable>

        <Text style={styles.demoTitle}>Patient demo accounts</Text>
        <View style={styles.demoGrid}>
          {demoAccounts.map((account) => (
            <Pressable
              key={account.email}
              onPress={() => {
                setEmail(account.email);
                setPassword('123456');
              }}
              style={styles.demoButton}
            >
              <Text style={styles.demoLabel}>{account.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  brandMark: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: colors.red,
    marginBottom: 18,
  },
  brandMarkText: {
    color: '#fff',
    fontSize: 27,
    fontWeight: '800',
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 28,
    textAlign: 'center',
    color: colors.muted,
  },
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    backgroundColor: colors.surface,
  },
  label: {
    marginBottom: 8,
    fontWeight: '700',
    color: colors.text,
  },
  input: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    color: colors.text,
  },
  button: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.red,
    marginTop: 2,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  demoTitle: {
    marginTop: 20,
    marginBottom: 10,
    fontWeight: '700',
    color: colors.muted,
  },
  demoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  demoButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  demoLabel: {
    color: colors.text,
    fontWeight: '700',
  },
});
