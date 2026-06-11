import { Smartphone, Stethoscope, Shield, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import indusLogo from '@/assets/indus-logo.svg';
import { useAuth } from '@/hooks/useAuth';

export default function PatientMobileOnly() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <img src={indusLogo} alt="Indus Hospital" className="h-14 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Patient Access Is Mobile-First</h1>
          <p className="text-sm text-muted-foreground mt-2">
            The production patient experience is reserved for the mobile app.
          </p>
        </div>

        <Card className="rounded-2xl border p-5 md:p-6">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border bg-secondary/50 p-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Smartphone className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-foreground">Mobile App</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Patients book appointments, view tokens, prescriptions, history, notifications, and video visits here.
              </p>
            </div>

            <div className="rounded-xl border bg-secondary/50 p-4">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mb-3">
                <Stethoscope className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-foreground">Web Portal</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Doctors, admins, and management use the web portal for operations, queue, analytics, and governance.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              <span>Doctor portal: /doctor</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Admin portal: /admin</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span>Management portal: /management</span>
            </div>
          </div>

          <Button onClick={signOut} className="mt-6 w-full rounded-xl">
            Sign Out
          </Button>
        </Card>
      </div>
    </div>
  );
}
