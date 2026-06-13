import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { IndusLogo } from '@/components/IndusLogo';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useI18n } from '@/i18n/LanguageContext';
import { useAuth } from '@/auth/AuthContext';
import { colors, radius, shadow, spacing } from '@/theme/colors';

const demoAccounts = [
  { label: 'Patient', email: 'patient1@example.com' },
  { label: 'Video Demo', email: 'video.patient1@example.com' },
];

export function LoginScreen() {
  const { signIn } = useAuth();
  const { t, isRtl } = useI18n();
  const [email, setEmail] = useState('patient1@example.com');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const align = { textAlign: isRtl ? 'right' : 'left' } as const;

  async function handleLogin() {
    try {
      setLoading(true);
      await signIn(email, password);
    } catch (error) {
      Alert.alert(t('login.failed'), error instanceof Error ? error.message : t('common.tryAgain'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.toggleRow}>
          <LanguageToggle />
        </View>

        <View style={styles.logoWrap}>
          <IndusLogo size={52} />
        </View>
        <Text style={styles.tagline}>{t('app.tagline')}</Text>

        <View style={styles.panel}>
          <Text style={[styles.welcome, align]}>{t('login.welcome')}</Text>
          <Text style={[styles.welcomeSub, align]}>{t('login.subtitle')}</Text>

          <Text style={[styles.label, align]}>{t('login.email')}</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused(null)}
            placeholder="email@example.com"
            placeholderTextColor={colors.subtle}
            style={[styles.input, focused === 'email' && styles.inputFocused]}
            value={email}
          />

          <Text style={[styles.label, align]}>{t('login.password')}</Text>
          <TextInput
            onChangeText={setPassword}
            onFocus={() => setFocused('password')}
            onBlur={() => setFocused(null)}
            placeholder="••••••••"
            placeholderTextColor={colors.subtle}
            secureTextEntry
            style={[styles.input, focused === 'password' && styles.inputFocused]}
            value={password}
          />

          <Pressable
            disabled={loading}
            onPress={handleLogin}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('login.signIn')}</Text>}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>{t('login.demo')}</Text>
            <View style={styles.divider} />
          </View>

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

        <Text style={styles.footer}>{t('login.footer')}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  toggleRow: { alignItems: 'flex-end', marginBottom: spacing.md },
  logoWrap: { alignItems: 'center', marginBottom: spacing.md },
  tagline: {
    marginBottom: spacing.xl,
    textAlign: 'center',
    color: colors.muted,
    lineHeight: 21,
    paddingHorizontal: spacing.sm,
  },
  panel: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surface, ...shadow.card },
  welcome: { fontSize: 19, fontWeight: '800', color: colors.ink },
  welcomeSub: { marginTop: 4, marginBottom: spacing.lg, color: colors.muted },
  label: { marginBottom: spacing.sm, fontWeight: '700', color: colors.text, fontSize: 13 },
  input: {
    height: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: colors.surface },
  button: {
    height: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginTop: spacing.xs,
    ...shadow.brand,
  },
  buttonPressed: { backgroundColor: colors.primaryDark },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md, gap: spacing.sm },
  divider: { flex: 1, height: 1, backgroundColor: colors.divider },
  dividerText: { color: colors.subtle, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  demoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  demoButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt,
  },
  demoLabel: { color: colors.text, fontWeight: '700', fontSize: 13 },
  footer: { marginTop: spacing.xl, textAlign: 'center', color: colors.subtle, fontSize: 12, fontWeight: '600' },
});
