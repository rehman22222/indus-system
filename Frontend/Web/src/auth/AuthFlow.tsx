import { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import indusLogo from '@/assets/indus-logo.svg';
import { authStore } from './authStore';
import { supabase } from '@/integrations/supabase/client';
import { useOTP } from '@/hooks/useOTP';
import { OTPInput } from '@/components/OTPInput';
import { roleFromEmail } from '@/lib/roleFromEmail';

// =================================================================
// AuthFlow — PATIENT self-service auth on real Supabase Auth, plus a
// fallback to the in-memory authStore for STAFF (who have no Supabase
// account).
//
//   login (password) ──────────────▶ Supabase signInWithPassword
//        │  └─ staff fallback ─────▶ authStore.login
//        ├─"create account"─▶ signup ─▶ signUp ─▶ otp ─▶ success ─▶ login
//        └─"forgot password"─▶ forgot ─▶ otp ─▶ updateUser ─▶ success
//
// Patients get a real persisted Supabase session — no authStore mirror.
// AuthGate observes the session and routes automatically.
// =================================================================

type Step =
  | 'login'
  | 'signup'
  | 'otp'
  | 'forgot'
  | 'forgotOtp'
  | 'success';

// Signup payload collected at the form step and carried through the
// custom-OTP step, where the real Supabase account is finally created.
interface PendingSignup {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  cnic: string;
  age: number;
  gender: string;
  // Only set when the edge function ran in OTP_DEV_MODE. Carried into
  // SignupOtpView so the code box can be auto-filled for fast local
  // testing without depending on email delivery.
  devOtp?: string;
}

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

// ---------- shared field components ----------

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-destructive mt-1">
      <AlertCircle className="h-3 w-3 shrink-0" /> {msg}
    </p>
  );
}

function PasswordInput({
  id, value, onChange, onBlur, placeholder, error, autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder: string;
  error?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={cn('rounded-xl h-11 pr-10', error && 'border-destructive focus-visible:ring-destructive')}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <FieldError msg={error} />
    </div>
  );
}

// ===================================================================
// AuthFlow
// ===================================================================

export function AuthFlow() {
  const [step, setStep] = useState<Step>('login');
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(null);
  const [successMsg, setSuccessMsg] = useState('Account created successfully!');

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-accent flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-6 animate-slide-down">
          <img src={indusLogo} alt="Indus Hospital" className="h-12 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Smart Healthcare Management</p>
        </div>

        <Card className="p-5 md:p-8 rounded-3xl border shadow-lg animate-scale-in">
          {step === 'login' && (
            <LoginView
              onSignup={() => setStep('signup')}
              onForgot={() => setStep('forgot')}
            />
          )}
          {step === 'signup' && (
            <SignupView
              onBack={() => setStep('login')}
              onOtpSent={(signup) => {
                setPendingSignup(signup);
                setPendingEmail(signup.email);
                setStep('otp');
              }}
            />
          )}
          {step === 'otp' && pendingSignup && (
            <SignupOtpView
              signup={pendingSignup}
              onVerified={() => {
                setSuccessMsg('Account created successfully!');
                setStep('success');
              }}
              onBack={() => setStep('signup')}
              onLoginInstead={() => setStep('login')}
            />
          )}
          {step === 'forgot' && (
            <ForgotView
              onBack={() => setStep('login')}
              onOtpSent={(email) => {
                setPendingEmail(email);
                setStep('forgotOtp');
              }}
            />
          )}
          {step === 'forgotOtp' && (
            <ForgotOtpView
              email={pendingEmail}
              onReset={() => {
                setSuccessMsg('Password updated successfully!');
                setStep('success');
              }}
              onBack={() => setStep('forgot')}
            />
          )}
          {step === 'success' && (
            <SuccessView message={successMsg} onDone={() => setStep('login')} />
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Staff demo login — Admin@gmail.com · password 123456
        </p>
      </div>
    </div>
  );
}

// ---------- Login (password) ----------

function LoginView({
  onSignup,
  onForgot,
}: {
  onSignup: () => void;
  onForgot: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const emailErr = touched.email ? validateField('email', email, {}) : '';
  const passErr = touched.password ? (password ? '' : 'Password is required.') : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setFormError('');

    if (validateField('email', email, {}) || !password) return;

    setSubmitting(true);
    try {
      // 1. Patients → real Supabase session (persisted; AuthGate routes).
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (!error && data.session) {
        toast.success('Signed in.');
        return; // onAuthStateChange + AuthGate take over.
      }

      // 2. Staff have no Supabase account → in-memory authStore.
      const staff = authStore.login(email.trim(), password);
      if ('error' in staff) {
        setFormError(
          error ? errMessage(error, 'Invalid email or password.') : staff.error,
        );
        return;
      }
      // Staff session set → AuthGate routes by role.
    } catch (err) {
      setFormError(errMessage(err, 'Login failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="text-center mb-2">
        <h1 className="text-xl font-bold">Welcome back</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Sign in to continue</p>
      </div>

      {formError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setFormError(''); }}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          className={cn('rounded-xl h-11', emailErr && 'border-destructive focus-visible:ring-destructive')}
        />
        <FieldError msg={emailErr} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">Password</Label>
          <button
            type="button"
            onClick={onForgot}
            className="text-xs text-primary font-medium hover:underline"
          >
            Forgot password?
          </button>
        </div>
        <PasswordInput
          id="login-password"
          value={password}
          autoComplete="current-password"
          placeholder="Enter your password"
          onChange={(v) => { setPassword(v); setFormError(''); }}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={passErr}
        />
      </div>

      <Button type="submit" className="w-full rounded-xl h-11" disabled={submitting}>
        {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…</> : 'Sign In'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New patient?{' '}
        <button type="button" onClick={onSignup} className="text-primary font-medium hover:underline">
          Create an account
        </button>
      </p>
    </form>
  );
}

// ---------- Signup ----------

const SIGNUP_FIELDS = [
  'firstName', 'lastName', 'cnic', 'email', 'phone',
  'password', 'confirmPassword', 'age', 'gender',
] as const;

function SignupView({
  onBack,
  onOtpSent,
}: {
  onBack: () => void;
  onOtpSent: (signup: PendingSignup) => void;
}) {
  const { sendOTP } = useOTP();
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

  const errorFor = (name: string) =>
    touched[name] ? validateField(name, values[name], values) : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      // Email confirmation is disabled in Supabase; verify the email via
      // our custom OTP first. The real account is only created in
      // SignupOtpView once the code is confirmed.
      const result = await sendOTP(email, fullName);
      if (!result.success) {
        setFormError(result.error ?? 'Could not send the verification code.');
        return;
      }
      if (result.devOtp) {
        toast.success(`Dev mode: code is ${result.devOtp} (auto-filled).`);
      } else {
        toast.success(`A 6-digit code was sent to ${email}.`);
      }
      onOtpSent({
        email,
        password: values.password,
        fullName,
        phone: values.phone.trim(),
        cnic: values.cnic.trim(),
        age: Number(values.age),
        gender: values.gender,
        devOtp: result.devOtp,
      });
    } catch (err) {
      setFormError(errMessage(err, 'Could not create the account.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to login
      </button>

      <div className="text-center">
        <h1 className="text-xl font-bold">Create patient account</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Register to book appointments</p>
      </div>

      {formError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="su-fn">First Name</Label>
          <Input id="su-fn" value={values.firstName}
            onChange={(e) => setVal('firstName', e.target.value)} onBlur={() => blur('firstName')}
            className={cn('rounded-xl h-11 mt-1.5', errorFor('firstName') && 'border-destructive')} />
          <FieldError msg={errorFor('firstName')} />
        </div>
        <div>
          <Label htmlFor="su-ln">Last Name</Label>
          <Input id="su-ln" value={values.lastName}
            onChange={(e) => setVal('lastName', e.target.value)} onBlur={() => blur('lastName')}
            className={cn('rounded-xl h-11 mt-1.5', errorFor('lastName') && 'border-destructive')} />
          <FieldError msg={errorFor('lastName')} />
        </div>
      </div>

      <div>
        <Label htmlFor="su-cnic">CNIC (13 digits)</Label>
        <Input id="su-cnic" inputMode="numeric" value={values.cnic}
          onChange={(e) => setVal('cnic', e.target.value.replace(/\D/g, '').slice(0, 13))}
          onBlur={() => blur('cnic')}
          placeholder="3520112345671"
          className={cn('rounded-xl h-11 mt-1.5', errorFor('cnic') && 'border-destructive')} />
        <FieldError msg={errorFor('cnic')} />
      </div>

      <div>
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" value={values.email}
          onChange={(e) => setVal('email', e.target.value)} onBlur={() => blur('email')}
          placeholder="you@example.com"
          className={cn('rounded-xl h-11 mt-1.5', errorFor('email') && 'border-destructive')} />
        <FieldError msg={errorFor('email')} />
      </div>

      <div>
        <Label htmlFor="su-phone">Phone Number</Label>
        <Input id="su-phone" value={values.phone}
          onChange={(e) => setVal('phone', e.target.value)} onBlur={() => blur('phone')}
          placeholder="+92 3XX XXXXXXX"
          className={cn('rounded-xl h-11 mt-1.5', errorFor('phone') && 'border-destructive')} />
        <FieldError msg={errorFor('phone')} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="su-age">Age</Label>
          <Input id="su-age" inputMode="numeric" value={values.age}
            onChange={(e) => setVal('age', e.target.value.replace(/\D/g, '').slice(0, 3))}
            onBlur={() => blur('age')}
            className={cn('rounded-xl h-11 mt-1.5', errorFor('age') && 'border-destructive')} />
          <FieldError msg={errorFor('age')} />
        </div>
        <div>
          <Label>Gender</Label>
          <Select value={values.gender} onValueChange={(v) => { setVal('gender', v); blur('gender'); }}>
            <SelectTrigger className={cn('rounded-xl h-11 mt-1.5', errorFor('gender') && 'border-destructive')}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          <FieldError msg={errorFor('gender')} />
        </div>
      </div>

      <div>
        <Label htmlFor="su-pw">Password</Label>
        <div className="mt-1.5">
          <PasswordInput id="su-pw" value={values.password}
            onChange={(v) => setVal('password', v)} onBlur={() => blur('password')}
            placeholder="Min 8 characters" error={errorFor('password')} autoComplete="new-password" />
        </div>
      </div>

      <div>
        <Label htmlFor="su-cpw">Confirm Password</Label>
        <div className="mt-1.5">
          <PasswordInput id="su-cpw" value={values.confirmPassword}
            onChange={(v) => setVal('confirmPassword', v)} onBlur={() => blur('confirmPassword')}
            placeholder="Re-enter password" error={errorFor('confirmPassword')} autoComplete="new-password" />
        </div>
      </div>

      <Button type="submit" className="w-full rounded-xl h-11" disabled={submitting}>
        {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating account…</> : 'Sign Up'}
      </Button>
    </form>
  );
}

// ---------- OTP digit input (shared) ----------

function OtpDigits({
  digits,
  setDigits,
  error,
}: {
  digits: string[];
  setDigits: (d: string[]) => void;
  error?: boolean;
}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const setDigit = (idx: number, val: string) => {
    const d = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = d;
    setDigits(next);
    if (d && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const onKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="flex justify-center gap-2" onPaste={onPaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          className={cn(
            'h-12 w-11 md:h-14 md:w-12 text-center text-lg font-bold rounded-xl border bg-card',
            'focus:outline-none focus:ring-2 focus:ring-primary',
            error ? 'border-destructive' : 'border-border',
          )}
        />
      ))}
    </div>
  );
}

// ---------- Signup OTP ----------

function SignupOtpView({
  signup,
  onVerified,
  onBack,
  onLoginInstead,
}: {
  signup: PendingSignup;
  onVerified: () => void;
  onBack: () => void;
  onLoginInstead: () => void;
}) {
  const { sendOTP, verifyOTP } = useOTP();
  const email = signup.email;
  // Auto-fill the code when the edge function ran in dev mode so the
  // developer can complete signup with one click of Verify.
  const [code, setCode] = useState(signup.devOtp ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  // True when the final supabase.auth.signUp reports the email is
  // already in auth.users — in that case the only path forward is to
  // log in (no further OTP retries will help).
  const [alreadyExists, setAlreadyExists] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const submit = useCallback(
    async (codeArg?: string) => {
      const otp = (codeArg ?? code).trim();
      if (otp.length !== 6) {
        setError('Enter all 6 digits.');
        return;
      }
      setSubmitting(true);
      try {
        // 1. Verify the custom OTP.
        const result = await verifyOTP(email, otp);
        if (!result.success) {
          const suffix =
            typeof result.remainingAttempts === 'number'
              ? ` (${result.remainingAttempts} attempt${result.remainingAttempts === 1 ? '' : 's'} left)`
              : '';
          setError((result.error ?? 'Incorrect or expired code.') + suffix);
          return;
        }

        // 2. Email verified — now create the real Supabase account.
        // (Email confirmation is disabled, so this returns a session
        // immediately and AuthGate routes the patient to their
        // dashboard.)
        const { error: suErr } = await supabase.auth.signUp({
          email: signup.email,
          password: signup.password,
          options: {
            data: {
              full_name: signup.fullName,
              phone: signup.phone,
              cnic: signup.cnic,
              age: signup.age,
              gender: signup.gender,
              // Stamp the role at signup based on the email pattern so
              // metadata stays consistent with what useAuth derives at
              // login. useAuth still treats email as the source of
              // truth, so this is belt-and-suspenders.
              role: roleFromEmail(signup.email) ?? 'PATIENT',
            },
          },
        });
        if (suErr) {
          // Detect the already-registered case so the UI can offer
          // "Sign in instead" rather than a dead-end retry.
          const code =
            (suErr as { code?: unknown }).code;
          const msg = errMessage(suErr, 'Could not create the account.');
          const isDuplicate =
            code === 'user_already_exists' ||
            /already (registered|exists)/i.test(msg);
          if (isDuplicate) {
            setAlreadyExists(true);
            setError('This email is already registered. Please sign in instead.');
          } else {
            setError(msg);
          }
          return;
        }

        onVerified();
      } catch (err) {
        setError(errMessage(err, 'Verification failed.'));
      } finally {
        setSubmitting(false);
      }
    },
    [code, email, signup, onVerified, verifyOTP],
  );

  const resend = async () => {
    if (cooldown > 0) return;
    setError('');
    const result = await sendOTP(email, signup.fullName);
    if (!result.success) {
      setError(result.error ?? 'Could not resend the code.');
      return;
    }
    if (result.devOtp) {
      toast.success(`Dev mode: new code is ${result.devOtp} (auto-filled).`);
      setCode(result.devOtp);
    } else {
      toast.success(`A new code was sent to ${email}.`);
      setCode('');
    }
    setCooldown(60);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="text-center">
        <h1 className="text-xl font-bold">Verify your email</h1>
        <p className="text-sm text-muted-foreground mt-1">
          We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>. Enter it below.
        </p>
      </div>

      <OTPInput
        value={code}
        onChange={(v) => { setCode(v); setError(''); }}
        onComplete={(v) => submit(v)}
        error={!!error}
        disabled={submitting}
      />

      {error && (
        <p className="flex items-center justify-center gap-1 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}

      {alreadyExists ? (
        <Button onClick={onLoginInstead} className="w-full rounded-xl h-11">
          Sign in instead
        </Button>
      ) : (
        <Button onClick={() => submit()} className="w-full rounded-xl h-11" disabled={submitting}>
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying…</> : 'Verify'}
        </Button>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Didn’t get it?{' '}
        <button
          type="button"
          disabled={cooldown > 0}
          onClick={resend}
          className={cn('font-medium', cooldown > 0 ? 'text-muted-foreground' : 'text-primary hover:underline')}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </p>
    </div>
  );
}

// ---------- Forgot password: enter email ----------

function ForgotView({
  onBack,
  onOtpSent,
}: {
  onBack: () => void;
  onOtpSent: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const emailErr = touched ? validateField('email', email, {}) : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (validateField('email', email, {})) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) {
        setFormError(errMessage(error, 'Could not send the reset code.'));
        return;
      }
      toast.success(`A 6-digit code was sent to ${email.trim()}.`);
      onOtpSent(email.trim());
    } catch (err2) {
      setFormError(errMessage(err2, 'Could not send the reset code.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to login
      </button>

      <div className="text-center">
        <h1 className="text-xl font-bold">Forgot password</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          We’ll email you a 6-digit code to reset it
        </p>
      </div>

      {formError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="fp-email">Email</Label>
        <Input
          id="fp-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setFormError(''); }}
          onBlur={() => setTouched(true)}
          className={cn('rounded-xl h-11', emailErr && 'border-destructive focus-visible:ring-destructive')}
        />
        <FieldError msg={emailErr} />
      </div>

      <Button type="submit" className="w-full rounded-xl h-11" disabled={submitting}>
        {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</> : 'Send code'}
      </Button>
    </form>
  );
}

// ---------- Forgot password: OTP + new password ----------

function ForgotOtpView({
  email,
  onReset,
  onBack,
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
  const cpErr = touched.cp
    ? validateField('confirmPassword', confirm, { password })
    : '';

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
        email,
        token: code,
        type: 'recovery',
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
      // End the recovery session so the patient signs in fresh.
      await supabase.auth.signOut();
      onReset();
    } catch (err) {
      setError(errMessage(err, 'Password reset failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="text-center">
        <h1 className="text-xl font-bold">Reset password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the code sent to <span className="font-medium text-foreground">{email}</span> and your new password
        </p>
      </div>

      <OtpDigits digits={digits} setDigits={(d) => { setDigits(d); setError(''); }} error={!!error} />

      <div className="space-y-1.5">
        <Label htmlFor="fp-pw">New Password</Label>
        <PasswordInput
          id="fp-pw"
          value={password}
          autoComplete="new-password"
          placeholder="Min 8 characters"
          onChange={(v) => { setPassword(v); setError(''); }}
          onBlur={() => setTouched((t) => ({ ...t, pw: true }))}
          error={pwErr}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="fp-cpw">Confirm New Password</Label>
        <PasswordInput
          id="fp-cpw"
          value={confirm}
          autoComplete="new-password"
          placeholder="Re-enter password"
          onChange={(v) => { setConfirm(v); setError(''); }}
          onBlur={() => setTouched((t) => ({ ...t, cp: true }))}
          error={cpErr}
        />
      </div>

      {error && (
        <p className="flex items-center justify-center gap-1 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}

      <Button onClick={submit} className="w-full rounded-xl h-11" disabled={submitting}>
        {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating…</> : 'Update password'}
      </Button>
    </div>
  );
}

// ---------- Success ----------

function SuccessView({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="text-center py-6 space-y-4 animate-scale-in">
      <div className="h-16 w-16 rounded-full bg-chart-3/15 flex items-center justify-center mx-auto">
        <CheckCircle2 className="h-10 w-10 text-chart-3" />
      </div>
      <div>
        <h1 className="text-xl font-bold">{message}</h1>
        <p className="text-sm text-muted-foreground mt-1">Redirecting you to login…</p>
      </div>
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
    </div>
  );
}
