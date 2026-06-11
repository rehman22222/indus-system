import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MongoDB } from '@/integrations/mongodb/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import indusLogo from '@/assets/indus-logo.svg';
import { Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = MongoDB.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleResetPassword = async () => {
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await MongoDB.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      toast({ title: 'Password Reset', description: 'Your password has been updated successfully.' });
      setTimeout(() => navigate('/'), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery && !success) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="bg-card border-b border-border px-4 py-3">
          <img src={indusLogo} alt="Indus Hospital" className="h-10 mx-auto" />
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-8 rounded-2xl text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Invalid Reset Link</h1>
            <p className="text-muted-foreground text-sm mb-6">
              This link is invalid or has expired. Please request a new password reset.
            </p>
            <Button onClick={() => navigate('/')} className="rounded-xl">
              Go to Home
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-card border-b border-border px-4 py-3">
        <img src={indusLogo} alt="Indus Hospital" className="h-10 mx-auto" />
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 rounded-2xl">
          {success ? (
            <div className="text-center">
              <CheckCircle2 className="h-16 w-16 text-chart-3 mx-auto mb-4" />
              <h1 className="text-xl font-bold mb-2">Password Updated!</h1>
              <p className="text-muted-foreground text-sm">Redirecting you to home...</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Lock className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-xl font-bold">Set New Password</h1>
                <p className="text-sm text-muted-foreground mt-1">Enter your new password below</p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="rounded-xl h-12"
                  />
                </div>
                <Button
                  onClick={handleResetPassword}
                  className="w-full rounded-xl h-12"
                  disabled={!password || !confirmPassword || loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Reset Password
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
