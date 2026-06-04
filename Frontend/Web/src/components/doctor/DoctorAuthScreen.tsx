import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import indusLogo from '@/assets/indus-logo.svg';
import { Stethoscope, AlertCircle, Mail, Lock } from 'lucide-react';

interface DoctorAuthScreenProps {
  onRealLogin: (email: string, password: string) => Promise<void>;
}

export function DoctorAuthScreen({ onRealLogin }: DoctorAuthScreenProps) {
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setAuthError('');
    setLoading(true);
    try {
      await onRealLogin(authForm.email, authForm.password);
    } catch (err: any) {
      setAuthError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Logo */}
      <div className="bg-card border-b border-border px-4 py-3 safe-area-top">
        <img src={indusLogo} alt="Indus Hospital" className="h-10 mx-auto" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 md:p-8 rounded-2xl border shadow-lg bg-card">
          <div className="text-center mb-6">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Stethoscope className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Doctor Portal</h1>
            <p className="text-sm text-muted-foreground mt-1">Monitor your daily schedule & patients</p>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-xl flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {authError}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="email" placeholder="doctor@indushospital.com" value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} className="pl-9 rounded-xl h-11" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="password" placeholder="Enter your password" value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} className="pl-9 rounded-xl h-11" />
              </div>
            </div>
            <Button onClick={handleLogin} className="w-full rounded-xl h-11"
              disabled={!authForm.email || !authForm.password || loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
