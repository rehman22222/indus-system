import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';

interface ForgotPasswordProps {
  onBack: () => void;
}

export function ForgotPassword({ onBack }: ForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <CheckCircle2 className="h-14 w-14 text-chart-3 mx-auto" />
        <div>
          <h2 className="text-lg font-bold">Check Your Email</h2>
          <p className="text-sm text-muted-foreground mt-1">
            We've sent a password reset link to <strong>{email}</strong>
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Didn't receive the email? Check your spam folder or try again.
        </p>
        <Button variant="outline" onClick={onBack} className="rounded-xl gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-lg font-bold">Forgot Password?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="space-y-2">
        <Label>Email Address</Label>
        <Input
          type="email"
          placeholder="your.email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl h-12"
        />
      </div>

      <Button
        onClick={handleSubmit}
        className="w-full rounded-xl h-12"
        disabled={!email || loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Send Reset Link
      </Button>

      <Button variant="ghost" onClick={onBack} className="w-full rounded-xl gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Sign In
      </Button>
    </div>
  );
}
