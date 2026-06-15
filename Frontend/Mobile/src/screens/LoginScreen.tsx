import React, { useEffect, useMemo, useState } from 'react';
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

import { sendPatientPasswordResetOtp, sendPatientSignupOtp } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';
import { IndusLogo } from '@/components/IndusLogo';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useI18n } from '@/i18n/LanguageContext';
import { radius, shadow, spacing } from '@/theme/colors';
import { useTheme, type ThemeColors } from '@/theme/ThemeContext';

type Mode = 'signin' | 'signup' | 'forgot';

export function LoginScreen() {
  const { signIn, completePatientSignup, completePasswordReset } = useAuth();
  const { t, isRtl } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [cnic, setCnic] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const align = { textAlign: isRtl ? 'right' : 'left' } as const;

  useEffect(() => {
    if (!otpSent || resendCooldown <= 0) return undefined;
    const timer = setInterval(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [otpSent, resendCooldown]);

  function switchMode(next: Mode) {
    setMode(next);
    setOtpSent(false);
    setOtp('');
    setConfirmPassword('');
    setResendCooldown(0);
    if (next === 'signup') {
      setEmail('');
      setPassword('');
    } else if (next === 'forgot' || mode === 'forgot') {
      setPassword('');
    }
  }

  async function handleSignIn() {
    try {
      setLoading(true);
      await signIn(email, password);
    } catch (error) {
      Alert.alert(t('login.failed'), error instanceof Error ? error.message : t('common.tryAgain'));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert('Valid email required', 'Enter the email address used for your patient account.');
      return;
    }

    try {
      setLoading(true);
      if (!otpSent) {
        const result = await sendPatientPasswordResetOtp(email);
        setOtpSent(true);
        setResendCooldown(60);
        Alert.alert('Reset code requested', result.message || 'If the account exists, a code has been sent to your email.');
        return;
      }

      if (otp.trim().length !== 6) {
        Alert.alert('Verification code required', 'Enter the 6-digit code sent to your email.');
        return;
      }
      if (password.length < 8) {
        Alert.alert('Password too short', 'Use at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Passwords do not match', 'Enter the same new password in both fields.');
        return;
      }

      await completePasswordReset({ email, code: otp, password });
      Alert.alert('Password updated', 'Your password has been reset successfully.');
    } catch (error) {
      Alert.alert('Could not reset password', error instanceof Error ? error.message : t('common.tryAgain'));
    } finally {
      setLoading(false);
    }
  }

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

  async function handleSignup() {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      Alert.alert('Missing details', 'Enter your first name, last name and email address.');
      return;
    }
    if (!/^\d{13}$/.test(cnic.trim())) {
      Alert.alert('Invalid CNIC', 'CNIC must be exactly 13 digits.');
      return;
    }
    const ageNum = Number(age);
    if (!ageNum || ageNum < 1 || ageNum > 120) {
      Alert.alert('Invalid age', 'Enter a valid age (1–120).');
      return;
    }
    if (!gender) {
      Alert.alert('Select gender', 'Please choose your gender.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.');
      return;
    }

    try {
      setLoading(true);
      if (!otpSent) {
        const result = await sendPatientSignupOtp(email, fullName);
        setOtpSent(true);
        setResendCooldown(60);
        Alert.alert('Verification code sent', result.message || `Check ${email.trim().toLowerCase()} for your 6-digit code.`);
        return;
      }

      if (!otp.trim()) {
        Alert.alert('Verification code required', 'Enter the code sent to your email.');
        return;
      }
      await completePatientSignup({ email, code: otp, password, name: fullName, phone, cnic: cnic.trim(), age: ageNum, gender });
    } catch (error) {
      Alert.alert('Could not create account', error instanceof Error ? error.message : t('common.tryAgain'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (loading || resendCooldown > 0) return;
    try {
      setLoading(true);
      const result = await sendPatientSignupOtp(email, fullName);
      setOtp('');
      setResendCooldown(60);
      Alert.alert('New code sent', result.message || `Check ${email.trim().toLowerCase()} for the new code.`);
    } catch (error) {
      Alert.alert('Could not resend code', error instanceof Error ? error.message : t('common.tryAgain'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetResend() {
    if (loading || resendCooldown > 0) return;
    try {
      setLoading(true);
      const result = await sendPatientPasswordResetOtp(email);
      setOtp('');
      setResendCooldown(60);
      Alert.alert('New reset code requested', result.message || 'If the account exists, a new code has been sent.');
    } catch (error) {
      Alert.alert('Could not resend code', error instanceof Error ? error.message : t('common.tryAgain'));
    } finally {
      setLoading(false);
    }
  }

  const fields = mode === 'signup' ? (
    <>
      <Field label="First name" value={firstName} onChangeText={setFirstName} focused={focused} setFocused={setFocused} id="firstName" editable={!otpSent} />
      <Field label="Last name" value={lastName} onChangeText={setLastName} focused={focused} setFocused={setFocused} id="lastName" editable={!otpSent} />
      <Field label="CNIC (13 digits)" value={cnic} onChangeText={(value) => setCnic(value.replace(/\D/g, '').slice(0, 13))} focused={focused} setFocused={setFocused} id="cnic" keyboardType="number-pad" maxLength={13} editable={!otpSent} />
      <Field label="Phone" value={phone} onChangeText={setPhone} focused={focused} setFocused={setFocused} id="phone" keyboardType="phone-pad" editable={!otpSent} />
      <Field label="Age" value={age} onChangeText={(value) => setAge(value.replace(/\D/g, '').slice(0, 3))} focused={focused} setFocused={setFocused} id="age" keyboardType="number-pad" maxLength={3} editable={!otpSent} />
      <Text style={styles.label}>Gender</Text>
      <View style={styles.genderRow}>
        {(['male', 'female', 'other'] as const).map((option) => {
          const active = gender === option;
          return (
            <Pressable
              key={option}
              disabled={otpSent}
              onPress={() => setGender(option)}
              style={[styles.genderPill, active && styles.genderPillActive, otpSent && styles.genderPillDisabled]}
            >
              <Text style={[styles.genderText, active && styles.genderTextActive]}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  ) : null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.toggleRow}><LanguageToggle /></View>
        <View style={styles.logoWrap}><IndusLogo size={48} /></View>
        <Text style={styles.tagline}>{t('app.tagline')}</Text>

        <View style={styles.panel}>
          {mode === 'forgot' ? (
            <Pressable onPress={() => switchMode('signin')} style={styles.backButton}>
              <Text style={styles.backText}>Back to sign in</Text>
            </Pressable>
          ) : (
            <View style={styles.modeControl}>
              <Pressable onPress={() => switchMode('signin')} style={[styles.modeButton, mode === 'signin' && styles.modeButtonActive]}>
                <Text style={[styles.modeText, mode === 'signin' && styles.modeTextActive]}>Sign In</Text>
              </Pressable>
              <Pressable onPress={() => switchMode('signup')} style={[styles.modeButton, mode === 'signup' && styles.modeButtonActive]}>
                <Text style={[styles.modeText, mode === 'signup' && styles.modeTextActive]}>Patient Sign Up</Text>
              </Pressable>
            </View>
          )}

          <Text style={[styles.welcome, align]}>
            {mode === 'signin' ? t('login.welcome') : mode === 'signup' ? 'Create patient account' : 'Reset patient password'}
          </Text>
          <Text style={[styles.welcomeSub, align]}>
            {mode === 'signin'
              ? 'Patients and doctors can sign in here.'
              : mode === 'signup'
                ? 'Patient registration uses secure email verification.'
                : otpSent
                  ? `Enter the code sent to ${email.trim().toLowerCase()} and choose a new password.`
                  : 'We will email a secure 6-digit code to your patient account.'}
          </Text>

          {fields}
          <Field label={t('login.email')} value={email} onChangeText={setEmail} focused={focused} setFocused={setFocused} id="email" keyboardType="email-address" autoCapitalize="none" editable={!otpSent} />
          {mode !== 'forgot' ? (
            <Field
              label={t('login.password')}
              value={password}
              onChangeText={setPassword}
              focused={focused}
              setFocused={setFocused}
              id="password"
              secureTextEntry
              editable={!otpSent}
            />
          ) : null}

          {mode === 'signin' && (
            <Pressable onPress={() => switchMode('forgot')} style={styles.forgotButton}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          )}

          {(mode === 'signup' || mode === 'forgot') && otpSent && (
            <>
              <Field
                label={mode === 'forgot' ? 'Password reset code' : 'Email verification code'}
                value={otp}
                onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
                focused={focused}
                setFocused={setFocused}
                id="otp"
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
              />
              {mode === 'forgot' && (
                <>
                  <Field
                    label="New password"
                    value={password}
                    onChangeText={setPassword}
                    focused={focused}
                    setFocused={setFocused}
                    id="password"
                    secureTextEntry
                  />
                  <Field
                    label="Confirm new password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    focused={focused}
                    setFocused={setFocused}
                    id="confirmPassword"
                    secureTextEntry
                  />
                </>
              )}
            </>
          )}

          <Pressable
            disabled={loading}
            onPress={mode === 'signin' ? handleSignIn : mode === 'signup' ? handleSignup : handleForgotPassword}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.buttonText}>
                {mode === 'signin'
                  ? t('login.signIn')
                  : mode === 'signup'
                    ? otpSent ? 'Verify and create account' : 'Send verification code'
                    : otpSent ? 'Verify and reset password' : 'Send reset code'}
              </Text>
            )}
          </Pressable>

          {mode === 'signup' && otpSent && (
            <View style={styles.verificationActions}>
              <Pressable disabled={loading || resendCooldown > 0} onPress={handleResend} style={styles.editButton}>
                <Text style={[styles.editText, resendCooldown > 0 && styles.actionDisabled]}>
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend verification code'}
                </Text>
              </Pressable>
              <Pressable onPress={() => { setOtpSent(false); setOtp(''); setResendCooldown(0); }} style={styles.editButton}>
                <Text style={styles.editText}>Edit account details</Text>
              </Pressable>
            </View>
          )}

          {mode === 'forgot' && otpSent && (
            <View style={styles.verificationActions}>
              <Pressable disabled={loading || resendCooldown > 0} onPress={handleResetResend} style={styles.editButton}>
                <Text style={[styles.editText, resendCooldown > 0 && styles.actionDisabled]}>
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend reset code'}
                </Text>
              </Pressable>
              <Pressable onPress={() => { setOtpSent(false); setOtp(''); setPassword(''); setConfirmPassword(''); setResendCooldown(0); }} style={styles.editButton}>
                <Text style={styles.editText}>Use a different email</Text>
              </Pressable>
            </View>
          )}

          {mode === 'signin' && (
            <Text style={styles.staffNote}>Doctors and staff use credentials issued by hospital administration.</Text>
          )}
        </View>
        <Text style={styles.footer}>{t('login.footer')}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & {
  id: string;
  label: string;
  focused: string | null;
  setFocused: (value: string | null) => void;
};

function Field({ id, label, focused, setFocused, ...props }: FieldProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        onFocus={() => setFocused(id)}
        onBlur={() => setFocused(null)}
        placeholderTextColor={colors.subtle}
        style={[styles.input, focused === id && styles.inputFocused]}
      />
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  toggleRow: { alignItems: 'flex-end', marginBottom: spacing.sm },
  logoWrap: { alignItems: 'center', marginBottom: spacing.sm },
  tagline: { marginBottom: spacing.lg, textAlign: 'center', color: colors.muted, lineHeight: 20 },
  panel: { borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surface, ...shadow.card },
  modeControl: { flexDirection: 'row', padding: 4, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, marginBottom: spacing.lg },
  modeButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  modeButtonActive: { backgroundColor: colors.surface, ...shadow.soft },
  modeText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  modeTextActive: { color: colors.primary, fontWeight: '800' },
  backButton: { alignSelf: 'flex-start', paddingVertical: spacing.sm, marginBottom: spacing.md },
  backText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  welcome: { fontSize: 19, fontWeight: '800', color: colors.ink },
  welcomeSub: { marginTop: 4, marginBottom: spacing.lg, color: colors.muted, lineHeight: 19 },
  label: { marginBottom: spacing.xs, fontWeight: '700', color: colors.text, fontSize: 13 },
  input: { height: 50, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceAlt, marginBottom: spacing.md, color: colors.text, fontSize: 15 },
  inputFocused: { borderColor: colors.primary, backgroundColor: colors.surface },
  forgotButton: { alignSelf: 'flex-end', paddingVertical: spacing.xs, marginTop: -spacing.sm, marginBottom: spacing.md },
  forgotText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  genderRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  genderPill: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  genderPillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  genderPillDisabled: { opacity: 0.6 },
  genderText: { color: colors.muted, fontWeight: '700' },
  genderTextActive: { color: colors.primary, fontWeight: '800' },
  button: { minHeight: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, marginTop: spacing.xs, paddingHorizontal: spacing.md, ...shadow.brand },
  buttonPressed: { backgroundColor: colors.primaryDark },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  editButton: { alignItems: 'center', paddingVertical: spacing.md },
  editText: { color: colors.navy, fontWeight: '700' },
  verificationActions: { marginTop: spacing.xs },
  staffNote: { marginTop: spacing.lg, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  actionDisabled: { color: colors.subtle },
  footer: { marginTop: spacing.xl, textAlign: 'center', color: colors.subtle, fontSize: 12, fontWeight: '600' },
});
