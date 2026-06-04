// =================================================================
// Mobile AuthFlow — RN port of Frontend/WEB/src/auth/AuthFlow.tsx
// =================================================================
//
//   login ─"create account"─▶ signup ─submit─▶ otp ─▶ success ─▶ login
//   login ─"forgot password"─▶ forgot ─submit─▶ forgotOtp ─▶ success ─▶ login
//
// • Patients: real Supabase email/password. A 6-digit email OTP (the
//   {{ .Token }} email template) verifies signup and gates password
//   reset. Verified patients are mirrored into the in-memory authStore
//   as PATIENT so existing routing keeps working.
// • Staff (admin/doctor/…) are NOT part of this flow — login falls
//   back to the in-memory authStore for them.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  Eye, EyeOff, AlertCircle, ArrowLeft, CheckCircle2,
} from 'lucide-react';
import { authStore } from '../auth/authStore';
import { supabase } from '../integrations/supabase/client';
import { colors, radius, spacing } from '../lib/theme';

type Step = 'login' | 'signup' | 'otp' | 'forgot' | 'forgotOtp' | 'success';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateField(name: string, value: string, all: Record<string, string>): string {
  switch (name) {
    case 'firstName':
      return value.trim() ? '' : 'First name is required.';
    case 'lastName':
      return value.trim() ? '' : 'Last name is required.';
    case 'cnic':
      if (!value.trim()) return 'CNIC is required.';
      return /^\d{13}$/.test(value) ? '' : 'CNIC must be exactly 13 digits.';
    case 'email':
      if (!value.trim()) return 'Email is required.';
      return EMAIL_RE.test(value) ? '' : 'Enter a valid email address.';
    case 'phone':
      return value.trim() ? '' : 'Phone number is required.';
    case 'password':
      if (!value) return 'Password is required.';
      return value.length >= 8 ? '' : 'Password must be at least 8 characters.';
    case 'confirmPassword':
      if (!value) return 'Please confirm your password.';
      return value === all.password ? '' : 'Passwords do not match.';
    case 'age': {
      if (!value.trim()) return 'Age is required.';
      const n = Number(value);
      return Number.isInteger(n) && n > 0 ? '' : 'Age must be a positive whole number.';
    }
    case 'gender':
      return value ? '' : 'Please select a gender.';
    default:
      return '';
  }
}

function errMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return fallback;
}

function routeForRole(navigation: any, role: string) {
  if (role === 'DOCTOR') navigation.replace('DoctorDashboard');
  else navigation.replace('PatientDashboard');
}

// ---------- shared bits ----------

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <View style={styles.fieldErrRow}>
      <AlertCircle size={12} color={colors.destructive} />
      <Text style={styles.fieldErrText}>{msg}</Text>
    </View>
  );
}

function FormError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <View style={styles.formErrBox}>
      <AlertCircle size={16} color={colors.destructive} />
      <Text style={styles.formErrText}>{msg}</Text>
    </View>
  );
}

function PasswordField({
  value, onChangeText, onBlur, placeholder, error,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  placeholder: string;
  error?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <View>
      <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry={!show}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={() => setShow((s) => !s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {show ? <EyeOff size={18} color={colors.mutedForeground} /> : <Eye size={18} color={colors.mutedForeground} />}
        </TouchableOpacity>
      </View>
      <FieldError msg={error} />
    </View>
  );
}

function OtpBoxes({
  digits, setDigits, error,
}: {
  digits: string[];
  setDigits: (d: string[]) => void;
  error?: boolean;
}) {
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const setDigit = (idx: number, val: string) => {
    const incoming = val.replace(/\D/g, '');
    if (incoming.length > 1) {
      const next = ['', '', '', '', '', ''];
      for (let i = 0; i < Math.min(incoming.length, 6); i++) next[i] = incoming[i];
      setDigits(next);
      inputs.current[Math.min(incoming.length, 5)]?.focus();
      return;
    }
    const next = [...digits];
    next[idx] = incoming.slice(-1);
    setDigits(next);
    if (incoming && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const onKeyPress = (idx: number, key: string) => {
    if (key === 'Backspace' && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  return (
    <View style={styles.otpRow}>
      {digits.map((d, i) => (
        <TextInput
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          style={[styles.otpBox, error ? styles.inputError : null]}
          keyboardType="number-pad"
          maxLength={6}
          value={d}
          onChangeText={(v) => setDigit(i, v)}
          onKeyPress={(e) => onKeyPress(i, e.nativeEvent.key)}
        />
      ))}
    </View>
  );
}

// ===================================================================

const LoginScreen = ({ navigation }: { navigation: any }) => {
  const [step, setStep] = useState<Step>('login');
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');
  const [pendingName, setPendingName] = useState('');
  const [successMsg, setSuccessMsg] = useState('Account created successfully!');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.logoBox}><Text style={styles.logoText}>IH</Text></View>
            <Text style={styles.brand}>Indus Health</Text>
            <Text style={styles.brandSub}>Smart Healthcare Management</Text>
          </View>

          <View style={styles.card}>
            {step === 'login' && (
              <LoginView
                onSignup={() => setStep('signup')}
                onForgot={() => setStep('forgot')}
                onAuthed={(role) => routeForRole(navigation, role)}
              />
            )}
            {step === 'signup' && (
              <SignupView
                onBack={() => setStep('login')}
                onOtpSent={(email, password, name) => {
                  setPendingEmail(email);
                  setPendingPassword(password);
                  setPendingName(name);
                  setStep('otp');
                }}
              />
            )}
            {step === 'otp' && (
              <SignupOtpView
                email={pendingEmail}
                password={pendingPassword}
                fullName={pendingName}
                onVerified={() => { setSuccessMsg('Account created successfully!'); setStep('success'); }}
                onBack={() => setStep('signup')}
              />
            )}
            {step === 'forgot' && (
              <ForgotView
                onBack={() => setStep('login')}
                onOtpSent={(email) => { setPendingEmail(email); setStep('forgotOtp'); }}
              />
            )}
            {step === 'forgotOtp' && (
              <ForgotOtpView
                email={pendingEmail}
                onReset={() => { setSuccessMsg('Password updated successfully!'); setStep('success'); }}
                onBack={() => setStep('forgot')}
              />
            )}
            {step === 'success' && <SuccessView message={successMsg} onDone={() => setStep('login')} />}
          </View>

          {step === 'login' && (
            <Text style={styles.demoLine}>Staff demo login — Admin@gmail.com · password 123456</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ---------- Login ----------

function LoginView({
  onSignup, onForgot, onAuthed,
}: {
  onSignup: () => void;
  onForgot: () => void;
  onAuthed: (role: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const emailErr = touched.email ? validateField('email', email, {}) : '';
  const passErr = touched.password ? (password ? '' : 'Password is required.') : '';

  const handleSubmit = async () => {
    setTouched({ email: true, password: true });
    setFormError('');
    if (validateField('email', email, {}) || !password) return;

    setSubmitting(true);
    try {
      // 1. Patients: real Supabase email/password.
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (!error && data.user) {
        const fullName =
          (data.user.user_metadata?.full_name as string | undefined) ?? '';
        authStore.syncPatientAccount(email.trim(), password, fullName);
        authStore.login(email.trim(), password);
        onAuthed('PATIENT');
        return;
      }

      // 2. Staff fall back to the in-memory store.
      const staff = authStore.login(email.trim(), password);
      if ('error' in staff) {
        setFormError(
          error ? errMessage(error, 'Invalid email or password.') : staff.error,
        );
        return;
      }
      onAuthed(staff.user.role);
    } catch (err) {
      setFormError(errMessage(err, 'Login failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      <View style={styles.center}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
      </View>

      <FormError msg={formError} />

      <View style={styles.group}>
        <Text style={styles.label}>Email</Text>
        <View style={[styles.inputWrapper, emailErr ? styles.inputError : null]}>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(v) => { setEmail(v); setFormError(''); }}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          />
        </View>
        <FieldError msg={emailErr} />
      </View>

      <View style={styles.group}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Password</Text>
          <TouchableOpacity onPress={onForgot} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
        </View>
        <PasswordField
          value={password}
          placeholder="Enter your password"
          onChangeText={(v) => { setPassword(v); setFormError(''); }}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={passErr}
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, submitting && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkRow} onPress={onSignup}>
        <Text style={styles.linkMuted}>
          New patient? <Text style={styles.link}>Create an account</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------- Signup ----------

const SIGNUP_FIELDS = [
  'firstName', 'lastName', 'cnic', 'email', 'phone',
  'password', 'confirmPassword', 'age', 'gender',
] as const;

function SignupView({
  onBack, onOtpSent,
}: {
  onBack: () => void;
  onOtpSent: (email: string, password: string, fullName: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({
    firstName: '', lastName: '', cnic: '', email: '', phone: '',
    password: '', confirmPassword: '', age: '', gender: '',
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const setVal = (name: string, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    setFormError('');
  };
  const blur = (name: string) => setTouched((t) => ({ ...t, [name]: true }));
  const errorFor = (name: string) => (touched[name] ? validateField(name, values[name], values) : '');

  const handleSubmit = async () => {
    const allTouched: Record<string, boolean> = {};
    let firstError = '';
    for (const f of SIGNUP_FIELDS) {
      allTouched[f] = true;
      const err = validateField(f, values[f], values);
      if (err && !firstError) firstError = err;
    }
    setTouched(allTouched);
    if (firstError) return;

    const email = values.email.trim();
    const fullName = `${values.firstName.trim()} ${values.lastName.trim()}`.trim();

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password: values.password,
        options: {
          data: {
            full_name: fullName,
            phone: values.phone.trim(),
            cnic: values.cnic.trim(),
            age: Number(values.age),
            gender: values.gender,
            role: 'PATIENT',
          },
        },
      });
      if (error) {
        setFormError(errMessage(error, 'Could not create the account.'));
        return;
      }
      onOtpSent(email, values.password, fullName);
    } catch (err) {
      setFormError(errMessage(err, 'Could not create the account.'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = (name: string) => [styles.inputWrapper, errorFor(name) ? styles.inputError : null];

  return (
    <View>
      <TouchableOpacity style={styles.backRow} onPress={onBack}>
        <ArrowLeft size={16} color={colors.mutedForeground} />
        <Text style={styles.backText}>Back to login</Text>
      </TouchableOpacity>

      <View style={styles.center}>
        <Text style={styles.title}>Create patient account</Text>
        <Text style={styles.subtitle}>Register to book appointments</Text>
      </View>

      <FormError msg={formError} />

      <View style={styles.row2}>
        <View style={styles.col}>
          <Text style={styles.label}>First Name</Text>
          <View style={inputStyle('firstName')}>
            <TextInput style={styles.input} value={values.firstName}
              placeholderTextColor={colors.mutedForeground}
              onChangeText={(v) => setVal('firstName', v)} onBlur={() => blur('firstName')} />
          </View>
          <FieldError msg={errorFor('firstName')} />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Last Name</Text>
          <View style={inputStyle('lastName')}>
            <TextInput style={styles.input} value={values.lastName}
              placeholderTextColor={colors.mutedForeground}
              onChangeText={(v) => setVal('lastName', v)} onBlur={() => blur('lastName')} />
          </View>
          <FieldError msg={errorFor('lastName')} />
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>CNIC (13 digits)</Text>
        <View style={inputStyle('cnic')}>
          <TextInput style={styles.input} value={values.cnic} keyboardType="number-pad"
            placeholder="3520112345671" placeholderTextColor={colors.mutedForeground}
            onChangeText={(v) => setVal('cnic', v.replace(/\D/g, '').slice(0, 13))}
            onBlur={() => blur('cnic')} />
        </View>
        <FieldError msg={errorFor('cnic')} />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Email</Text>
        <View style={inputStyle('email')}>
          <TextInput style={styles.input} value={values.email} keyboardType="email-address"
            autoCapitalize="none" placeholder="you@example.com" placeholderTextColor={colors.mutedForeground}
            onChangeText={(v) => setVal('email', v)} onBlur={() => blur('email')} />
        </View>
        <FieldError msg={errorFor('email')} />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Phone Number</Text>
        <View style={inputStyle('phone')}>
          <TextInput style={styles.input} value={values.phone} keyboardType="phone-pad"
            placeholder="+92 3XX XXXXXXX" placeholderTextColor={colors.mutedForeground}
            onChangeText={(v) => setVal('phone', v)} onBlur={() => blur('phone')} />
        </View>
        <FieldError msg={errorFor('phone')} />
      </View>

      <View style={styles.row2}>
        <View style={styles.col}>
          <Text style={styles.label}>Age</Text>
          <View style={inputStyle('age')}>
            <TextInput style={styles.input} value={values.age} keyboardType="number-pad"
              placeholderTextColor={colors.mutedForeground}
              onChangeText={(v) => setVal('age', v.replace(/\D/g, '').slice(0, 3))}
              onBlur={() => blur('age')} />
          </View>
          <FieldError msg={errorFor('age')} />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.genderRow}>
            {(['Male', 'Female', 'Other'] as const).map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.genderChip, values.gender === g && styles.genderChipActive]}
                onPress={() => { setVal('gender', g); blur('gender'); }}
              >
                <Text style={[styles.genderChipText, values.gender === g && styles.genderChipTextActive]}>
                  {g === 'Other' ? 'Other' : g[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <FieldError msg={errorFor('gender')} />
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Password</Text>
        <PasswordField value={values.password} placeholder="Min 8 characters"
          onChangeText={(v) => setVal('password', v)} onBlur={() => blur('password')}
          error={errorFor('password')} />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Confirm Password</Text>
        <PasswordField value={values.confirmPassword} placeholder="Re-enter password"
          onChangeText={(v) => setVal('confirmPassword', v)} onBlur={() => blur('confirmPassword')}
          error={errorFor('confirmPassword')} />
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, submitting && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.primaryBtnText}>Sign Up</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ---------- Signup OTP ----------

function SignupOtpView({
  email, password, fullName, onVerified, onBack,
}: {
  email: string;
  password: string;
  fullName: string;
  onVerified: () => void;
  onBack: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(async () => {
    const code = digits.join('');
    if (code.length !== 6) {
      setError('Enter all 6 digits.');
      return;
    }
    setSubmitting(true);
    try {
      const { error: vErr } = await supabase.auth.verifyOtp({
        email, token: code, type: 'signup',
      });
      if (vErr) {
        setError(errMessage(vErr, 'Incorrect or expired code.'));
        return;
      }
      await supabase.auth.signOut();
      authStore.syncPatientAccount(email, password, fullName);
      onVerified();
    } catch (err) {
      setError(errMessage(err, 'Verification failed.'));
    } finally {
      setSubmitting(false);
    }
  }, [digits, email, password, fullName, onVerified]);

  const resend = async () => {
    setError('');
    const { error: rErr } = await supabase.auth.resend({ type: 'signup', email });
    if (rErr) {
      setError(errMessage(rErr, 'Could not resend the code.'));
      return;
    }
    setDigits(['', '', '', '', '', '']);
  };

  return (
    <View>
      <TouchableOpacity style={styles.backRow} onPress={onBack}>
        <ArrowLeft size={16} color={colors.mutedForeground} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.center}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code sent to {email}</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>A 6-digit code was emailed to {email}.</Text>
      </View>

      <OtpBoxes digits={digits} setDigits={(d) => { setDigits(d); setError(''); }} error={!!error} />

      {error ? (
        <View style={styles.otpErrRow}>
          <AlertCircle size={14} color={colors.destructive} />
          <Text style={styles.fieldErrText}>{error}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.primaryBtn, submitting && styles.btnDisabled]}
        onPress={submit}
        disabled={submitting}
      >
        {submitting ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.primaryBtnText}>Verify</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkRow} onPress={resend}>
        <Text style={styles.linkMuted}>Didn't get it? <Text style={styles.link}>Resend code</Text></Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------- Forgot password: email ----------

function ForgotView({
  onBack, onOtpSent,
}: {
  onBack: () => void;
  onOtpSent: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const emailErr = touched ? validateField('email', email, {}) : '';

  const handleSubmit = async () => {
    setTouched(true);
    if (validateField('email', email, {})) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) {
        setFormError(errMessage(error, 'Could not send the reset code.'));
        return;
      }
      onOtpSent(email.trim());
    } catch (err) {
      setFormError(errMessage(err, 'Could not send the reset code.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      <TouchableOpacity style={styles.backRow} onPress={onBack}>
        <ArrowLeft size={16} color={colors.mutedForeground} />
        <Text style={styles.backText}>Back to login</Text>
      </TouchableOpacity>

      <View style={styles.center}>
        <Text style={styles.title}>Forgot password</Text>
        <Text style={styles.subtitle}>We'll email you a 6-digit code to reset it</Text>
      </View>

      <FormError msg={formError} />

      <View style={styles.group}>
        <Text style={styles.label}>Email</Text>
        <View style={[styles.inputWrapper, emailErr ? styles.inputError : null]}>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(v) => { setEmail(v); setFormError(''); }}
            onBlur={() => setTouched(true)}
          />
        </View>
        <FieldError msg={emailErr} />
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, submitting && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.primaryBtnText}>Send code</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ---------- Forgot password: OTP + new password ----------

function ForgotOtpView({
  email, onReset, onBack,
}: {
  email: string;
  onReset: () => void;
  onBack: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pwErr = touched.pw ? validateField('password', password, {}) : '';
  const cpErr = touched.cp ? validateField('confirmPassword', confirm, { password }) : '';

  const submit = async () => {
    setTouched({ pw: true, cp: true });
    const code = digits.join('');
    if (code.length !== 6) {
      setError('Enter all 6 digits.');
      return;
    }
    if (validateField('password', password, {}) ||
        validateField('confirmPassword', confirm, { password })) {
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const { error: vErr } = await supabase.auth.verifyOtp({
        email, token: code, type: 'recovery',
      });
      if (vErr) {
        setError(errMessage(vErr, 'Incorrect or expired code.'));
        return;
      }
      const { error: uErr } = await supabase.auth.updateUser({ password });
      if (uErr) {
        setError(errMessage(uErr, 'Could not update the password.'));
        return;
      }
      authStore.syncPatientAccount(email, password, '');
      await supabase.auth.signOut();
      onReset();
    } catch (err) {
      setError(errMessage(err, 'Password reset failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      <TouchableOpacity style={styles.backRow} onPress={onBack}>
        <ArrowLeft size={16} color={colors.mutedForeground} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.center}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>Enter the code sent to {email} and your new password</Text>
      </View>

      <OtpBoxes digits={digits} setDigits={(d) => { setDigits(d); setError(''); }} error={!!error} />

      <View style={styles.group}>
        <Text style={styles.label}>New Password</Text>
        <PasswordField
          value={password}
          placeholder="Min 8 characters"
          onChangeText={(v) => { setPassword(v); setError(''); }}
          onBlur={() => setTouched((t) => ({ ...t, pw: true }))}
          error={pwErr}
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Confirm New Password</Text>
        <PasswordField
          value={confirm}
          placeholder="Re-enter password"
          onChangeText={(v) => { setConfirm(v); setError(''); }}
          onBlur={() => setTouched((t) => ({ ...t, cp: true }))}
          error={cpErr}
        />
      </View>

      {error ? (
        <View style={styles.otpErrRow}>
          <AlertCircle size={14} color={colors.destructive} />
          <Text style={styles.fieldErrText}>{error}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.primaryBtn, submitting && styles.btnDisabled]}
        onPress={submit}
        disabled={submitting}
      >
        {submitting ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.primaryBtnText}>Update password</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ---------- Success ----------

function SuccessView({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <View style={styles.successWrap}>
      <View style={styles.successCircle}>
        <CheckCircle2 size={40} color={colors.chart3} />
      </View>
      <Text style={styles.title}>{message}</Text>
      <Text style={styles.subtitle}>Redirecting you to login…</Text>
      <ActivityIndicator color={colors.mutedForeground} style={{ marginTop: spacing.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  logoBox: { width: 64, height: 64, borderRadius: radius.xl, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  logoText: { fontSize: 26, fontWeight: 'bold', color: colors.primaryForeground },
  brand: { fontSize: 22, fontWeight: 'bold', color: colors.foreground },
  brandSub: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },

  card: { backgroundColor: colors.card, borderRadius: radius.xxl, padding: 24, borderWidth: 1, borderColor: colors.border, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16 },
  center: { alignItems: 'center', marginBottom: spacing.lg },
  title: { fontSize: 19, fontWeight: 'bold', color: colors.foreground, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.mutedForeground, marginTop: 3, textAlign: 'center' },

  group: { marginBottom: spacing.lg },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row2: { flexDirection: 'row', gap: 12, marginBottom: spacing.lg },
  col: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', color: colors.secondaryForeground, marginBottom: 6 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.secondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 },
  inputError: { borderColor: colors.destructive },
  input: { flex: 1, height: 46, fontSize: 15, color: colors.foreground },

  fieldErrRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  fieldErrText: { color: colors.destructive, fontSize: 12 },
  formErrBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.destructive + '14', paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.lg, marginBottom: spacing.lg },
  formErrText: { color: colors.destructive, fontSize: 13, flex: 1 },

  primaryBtn: { height: 50, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', marginTop: 6 },
  primaryBtnText: { color: colors.primaryForeground, fontSize: 16, fontWeight: 'bold' },
  btnDisabled: { opacity: 0.7 },

  linkRow: { marginTop: spacing.lg, alignItems: 'center' },
  linkMuted: { fontSize: 14, color: colors.mutedForeground },
  link: { color: colors.primary, fontWeight: '600', fontSize: 13 },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.md },
  backText: { fontSize: 13, color: colors.mutedForeground },

  genderRow: { flexDirection: 'row', gap: 6 },
  genderChip: { flex: 1, height: 46, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center' },
  genderChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  genderChipText: { fontSize: 14, fontWeight: '600', color: colors.secondaryForeground },
  genderChipTextActive: { color: colors.primaryForeground },

  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
  otpBox: { width: 46, height: 54, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, textAlign: 'center', fontSize: 20, fontWeight: 'bold', color: colors.foreground },
  otpErrRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: spacing.md },
  infoBox: { backgroundColor: colors.chart4 + '22', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, marginBottom: spacing.lg },
  infoText: { fontSize: 12, color: colors.foreground, fontWeight: '600', textAlign: 'center' },

  successWrap: { alignItems: 'center', paddingVertical: spacing.xl },
  successCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.chart3 + '22', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg },

  demoLine: { textAlign: 'center', fontSize: 12, color: colors.mutedForeground, marginTop: spacing.xl },
});

export default LoginScreen;
