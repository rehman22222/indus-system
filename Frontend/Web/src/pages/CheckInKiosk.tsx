import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCheckIn } from '@/hooks/useAppointments';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import indusLogo from '@/assets/indus-logo.svg';
import {
  CheckCircle2,
  QrCode,
  User,
  Clock,
  Stethoscope,
  MapPin,
  ArrowLeft,
  Scan,
  Hash,
  Loader2,
} from 'lucide-react';
import type { Appointment } from '@/hooks/useAppointments';

export default function CheckInKiosk() {
  const { checkInByToken, loading: isLoading } = useCheckIn();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [mode, setMode] = useState<'scan' | 'manual' | 'success'>('scan');
  const [token, setToken] = useState('');
  const [patientId, setPatientId] = useState('');
  const [checkedInAppointment, setCheckedInAppointment] = useState<Appointment | null>(null);
  
  // Handle QR code scan result from URL
  useEffect(() => {
    const qrToken = searchParams.get('token');
    const qrPatientId = searchParams.get('pid');
    
    if (qrToken && qrPatientId) {
      handleCheckIn(qrToken, qrPatientId);
    }
  }, [searchParams]);
  
  const handleCheckIn = async (checkToken: string, _checkPatientId?: string) => {
    const result = await checkInByToken(checkToken);

    if (!result.success || !result.appointment) {
      toast({
        title: "Check-In Failed",
        description: result.error || "Invalid token, or appointment not found.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Check-In Successful!",
      description: `Welcome! Please wait for your turn.`,
    });

    setCheckedInAppointment(result.appointment);
    setMode('success');
  };
  
  const handleManualCheckIn = () => {
    if (!token || !patientId) {
      toast({
        title: "Missing Information",
        description: "Please enter both Token and Patient ID",
        variant: "destructive",
      });
      return;
    }
    handleCheckIn(token, patientId);
  };
  
  const resetKiosk = () => {
    setMode('scan');
    setToken('');
    setPatientId('');
    setCheckedInAppointment(null);
    navigate('/check-in', { replace: true });
  };
  
  // Success Screen
  if (mode === 'success' && checkedInAppointment) {
    const doctor = checkedInAppointment.doctor;
    const patient = checkedInAppointment.patient;
    
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-card border-b border-border px-4 py-4 safe-area-top">
          <div className="max-w-lg mx-auto flex items-center justify-center">
            <img src={indusLogo} alt="Indus Hospital" className="h-12" />
          </div>
        </header>
        
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-8 rounded-3xl text-center">
            <div className="h-24 w-24 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-foreground mb-2">Check-In Complete!</h1>
            <p className="text-muted-foreground mb-6">You're all set for your appointment</p>
            
            <div className="bg-secondary/50 rounded-2xl p-6 mb-6 text-left space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Patient</p>
                  <p className="font-medium">{patient?.name || 'Unknown'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
                  <Stethoscope className="h-5 w-5 text-chart-3" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Doctor</p>
                  <p className="font-medium">{doctor?.name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{doctor?.specialty}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                  <Hash className="h-5 w-5 text-chart-2" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Your Token</p>
                  <p className="text-2xl font-bold text-primary">{checkedInAppointment.token}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                  <Clock className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Appointment Time</p>
                  <p className="font-medium">{checkedInAppointment.appointment_time}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-medium">Main Building</p>
                </div>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-6">
              Please have a seat in the waiting area. You will be called when it's your turn.
            </p>
            
            <Button onClick={resetKiosk} className="w-full rounded-xl h-12" variant="outline">
              Done
            </Button>
          </Card>
        </main>
        
        {/* Auto-reset after 30 seconds */}
        <AutoReset onReset={resetKiosk} seconds={30} />
      </div>
    );
  }
  
  // Scan / Manual Entry Screen
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border px-4 py-4 safe-area-top">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={indusLogo} alt="Indus Hospital" className="h-10" />
          <div className="w-10" />
        </div>
      </header>
      
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 rounded-3xl">
          <div className="text-center mb-8">
            <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <QrCode className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Patient Check-In</h1>
            <p className="text-muted-foreground mt-2">
              Scan your QR code or enter details manually
            </p>
          </div>
          
          {/* Mode Toggle */}
          <div className="flex bg-secondary/50 rounded-xl p-1 mb-6">
            <button
              onClick={() => setMode('scan')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                mode === 'scan' ? "bg-card shadow text-foreground" : "text-muted-foreground"
              }`}
            >
              <Scan className="h-4 w-4" />
              Scan QR
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                mode === 'manual' ? "bg-card shadow text-foreground" : "text-muted-foreground"
              }`}
            >
              <Hash className="h-4 w-4" />
              Manual Entry
            </button>
          </div>
          
          {mode === 'scan' ? (
            <div className="text-center space-y-6">
              <div className="bg-secondary/30 rounded-2xl p-8 border-2 border-dashed border-border">
                <Scan className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Open your Patient App and show the QR code to the scanner
                </p>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Or{' '}
                <button
                  onClick={() => setMode('manual')}
                  className="text-primary font-medium hover:underline"
                >
                  enter your details manually
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token">Appointment Token</Label>
                <Input
                  id="token"
                  placeholder="e.g., A-1"
                  value={token}
                  onChange={(e) => setToken(e.target.value.toUpperCase())}
                  className="rounded-xl h-12 text-center text-lg font-mono"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="patientId">Patient ID</Label>
                <Input
                  id="patientId"
                  placeholder="e.g., IND-2024-1234"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value.toUpperCase())}
                  className="rounded-xl h-12 text-center font-mono"
                />
              </div>
              
              <Button 
                onClick={handleManualCheckIn} 
                className="w-full rounded-xl h-12 text-base mt-4"
                disabled={!token || !patientId || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Checking In...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Check In
                  </>
                )}
              </Button>
              
              <div className="mt-6 p-4 bg-secondary/50 rounded-xl">
                <p className="text-xs text-muted-foreground text-center">
                  Enter your Token and Patient ID to check in
                </p>
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

// Auto-reset component
function AutoReset({ onReset, seconds }: { onReset: () => void; seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          onReset();
          return seconds;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [onReset, seconds]);
  
  return (
    <div className="fixed bottom-4 left-0 right-0 text-center safe-area-bottom">
      <p className="text-sm text-muted-foreground">
        Screen will reset in {remaining} seconds
      </p>
    </div>
  );
}
