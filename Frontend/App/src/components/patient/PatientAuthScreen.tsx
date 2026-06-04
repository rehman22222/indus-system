import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, Loader2, User, Mail, Lock, Phone } from 'lucide-react';
import { ForgotPassword } from './ForgotPassword';
import indusLogo from '@/assets/indus-logo.svg';

type AuthMode = 'signin' | 'signup';

interface PatientAuthScreenProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, name: string, phone: string, age?: string, gender?: string) => Promise<void>;
  onDemoLogin: () => void;
}

export function PatientAuthScreen({ onSignIn, onSignUp, onDemoLogin }: PatientAuthScreenProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [form, setForm] = useState({
    email: '', password: '', name: '', phone: '', age: '', gender: '',
  });

  // Check if Supabase is configured
  const isConfigured = Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
    !import.meta.env.VITE_SUPABASE_URL.includes('placeholder')
  );

  const handleSignIn = async () => {
    setAuthError('');
    if (!form.email.trim() || !form.password.trim()) {
      setAuthError('Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      await onSignIn(form.email, form.password);
    } catch (err: any) {
      setAuthError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setAuthError('');
    if (!form.email || !form.password || !form.name || !form.phone) {
      setAuthError('Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      await onSignUp(form.email, form.password, form.name, form.phone, form.age, form.gender);
    } catch (err: any) {
      setAuthError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Logo */}
      <div className="bg-card border-b border-border px-4 py-3 safe-area-top">
        <img src={indusLogo} alt="Indus Hospital" className="h-10 mx-auto" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 md:p-8 rounded-2xl border shadow-lg bg-card">
          {/* Auth Mode Title */}
          <div className="text-center mb-6">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">
              {authMode === 'signin' ? 'Patient Portal' : 'Create Account'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {authMode === 'signin' ? 'Access your health records & book appointments' : 'Join Indus Hospital Health Network'}
            </p>
          </div>

          {/* Demo Mode Banner */}
          {!isConfigured && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-xs text-yellow-800 text-center">
                ⚠️ Demo Mode — enter with mock data
              </p>
            </div>
          )}

          {authError && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-xl flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" /> {authError}
            </div>
          )}

          {showForgotPassword ? (
            <ForgotPassword onBack={() => setShowForgotPassword(false)} />
          ) : authMode === 'signin' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="email" placeholder="patient@example.com" value={form.email}
                    onChange={(e) => update('email', e.target.value)} className="pl-9 rounded-xl h-11"
                    autoCapitalize="none" autoCorrect="off" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="password" placeholder="Your password" value={form.password}
                    onChange={(e) => update('password', e.target.value)} className="pl-9 rounded-xl h-11" />
                </div>
              </div>
              <Button onClick={handleSignIn} className="w-full rounded-xl h-11 mt-2" disabled={!form.email || !form.password || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Login
              </Button>

              {/* Demo Mode Button */}
              <Button
                variant="outline"
                onClick={onDemoLogin}
                className="w-full rounded-xl h-11"
              >
                Try Demo Mode
              </Button>

              {/* Switch to Sign Up */}
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Don't have an account? Sign Up
                </button>
              </div>

              {/* Optional: Forgot Password Link */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Forgot password?
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Enter your full name" value={form.name}
                    onChange={(e) => update('name', e.target.value)} className="pl-9 rounded-xl h-11"
                    autoCapitalize="words" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="email" placeholder="patient@example.com" value={form.email}
                    onChange={(e) => update('email', e.target.value)} className="pl-9 rounded-xl h-11"
                    autoCapitalize="none" autoCorrect="off" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="password" placeholder="Your password" value={form.password}
                    onChange={(e) => update('password', e.target.value)} className="pl-9 rounded-xl h-11" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="+92 3XX XXXXXXX" value={form.phone}
                    onChange={(e) => update('phone', e.target.value)} className="pl-9 rounded-xl h-11" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Age</Label>
                  <Input type="number" placeholder="Age" value={form.age}
                    onChange={(e) => update('age', e.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={form.gender} onValueChange={(v) => update('gender', v)}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSignUp} className="w-full rounded-xl h-11 mt-2"
                disabled={!form.name || !form.email || !form.password || !form.phone || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Create Account
              </Button>

              {/* Switch to Sign In */}
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => { setAuthMode('signin'); setAuthError(''); }}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Already have an account? Login
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
