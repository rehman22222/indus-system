import { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowLeft, CalendarDays, ShieldCheck, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import indusLogo from '@/assets/indus-logo.svg';
import { MongoDB } from '@/integrations/mongodb/client';
import { useOTP } from '@/hooks/useOTP';
import { OTPInput } from '@/components/OTPInput';

// =================================================================
// AuthFlow — backend-backed authentication for patients and staff.
//
//   login (password) ──────────────▶ MongoDB signInWithPassword
//        ├─"create account"─▶ signup ─▶ signUp ─▶ otp ─▶ success ─▶ login
//        └─"forgot password"─▶ forgot ─▶ otp ─▶ updateUser ─▶ success
//
// Patients get a real persisted MongoDB session — no authStore mirror.
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
// custom-OTP step, where the real MongoDB account is finally created.
interface PendingSignup {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  cnic: string;
  age: number;
  gender: string;
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
    <div className="min-h-screen flex items-center justify-center px-4 py-6 md:px-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-card shadow-[0_24px_70px_rgba(15,30,51,0.14)] md:grid-cols-[0.9fr_1.1fr] animate-fade-in">
        <aside className="brand-panel relative hidden min-h-[650px] flex-col justify-between overflow-hidden p-9 text-white md:flex">
          <div>
            <div className="inline-flex rounded-2xl bg-white px-4 py-3 shadow-lg">
              <img src={indusLogo} alt="Indus Hospital" className="h-11 w-auto" />
            </div>
            <div className="mt-10 max-w-sm">
              <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-white/60">Digital Care Portal</p>
              <h1 className="mt-3 text-4xl font-extrabold leading-tight">Your healthcare journey, connected.</h1>
              <p className="mt-4 text-sm leading-6 text-white/70">Appointments, consultations, records, and prescriptions in one secure place.</p>
            </div>
          </div>

          <div className="grid gap-3">
            {[
              { icon: CalendarDays, text: 'Book and manage appointments' },
              { icon: Video, text: 'Join secure video consultations' },
              { icon: ShieldCheck, text: 'Protected patient information' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><Icon className="h-4 w-4" /></span>
                <span className="text-sm font-semibold text-white/90">{text}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex flex-col justify-center p-4 sm:p-7 md:p-10">
          <div className="mb-5 text-center md:hidden animate-slide-down">
            <div className="brand-panel rounded-3xl px-5 py-5 shadow-[0_14px_32px_rgba(18,38,67,0.2)]">
              <div className="inline-flex rounded-xl bg-white px-3 py-2">
                <img src={indusLogo} alt="Indus Hospital" className="h-9 w-auto" />
              </div>
              <p className="mt-3 text-xs font-semibold text-white/70">Smart Healthcare Management</p>
            </div>
          </div>

          <Card className="border-0 p-3 shadow-none sm:p-5 md:p-0 animate-scale-in">
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
          <p className="mt-5 text-center text-[11px] font-medium text-muted-foreground">INDUS Hospital & Health Network · Secure care portal</p>
        </div>
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
      const { data, error } = await MongoDB.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (!error && data.session) {
        toast.success('Signed in.');
        return;
      }
      setFormError(error ? errMessage(error, 'Invalid email or password.') : 'Invalid email or password.');
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
        <button type="button" onClick={onSignup} className="font-semibold text-primary hover:underline">
          Create patient account
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
      // Email confirmation is disabled in MongoDB; verify the email via
      // our custom OTP first. The real account is only created in
      // SignupOtpView once the code is confirmed.
      const result = await sendOTP(email, fullName);
      if (!result.success) {
        setFormError(result.error ?? 'Could not send the verification code.');
        return;
      }
      toast.success(`A 6-digit code was sent to ${email}.`);
      onOtpSent({
        email,
        password: values.password,
        fullName,
        phone: values.phone.trim(),
        cnic: values.cnic.trim(),
        age: Number(values.age),
        gender: values.gender,
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
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  // True when the final MongoDB.auth.signUp reports the email is
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
        const result = await verifyOTP(email, otp, {
          password: signup.password,
          name: signup.fullName,
          phone: signup.phone,
          cnic: signup.cnic,
          age: signup.age,
          gender: signup.gender,
        });
        if (!result.success) {
          const suffix =
            typeof result.remainingAttempts === 'number'
              ? ` (${result.remainingAttempts} attempt${result.remainingAttempts === 1 ? '' : 's'} left)`
              : '';
          setError((result.error ?? 'Incorrect or expired code.') + suffix);
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
    toast.success(`A new code was sent to ${email}.`);
    setCode('');
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
      const { error } = await MongoDB.auth.resetPasswordForEmail(email.trim());
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
  const { verifyOTP } = useOTP();
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
      const result = await verifyOTP(email, code, { password, purpose: 'password-reset' }, false);
      if (!result.success) {
        setError(result.error || 'Incorrect or expired code.');
        return;
      }
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
