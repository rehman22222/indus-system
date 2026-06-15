import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDoctors, useDoctorByEmail } from '@/hooks/useDoctors';
import { useDoctorAppointments, useUpdateAppointment } from '@/hooks/useAppointments';
import { useDoctorPrescriptions } from '@/hooks/usePrescriptions';
import { MongoDB, onServerEvent } from '@/integrations/mongodb/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Loader2, ShieldCheck } from 'lucide-react';
import { DoctorAuthScreen } from '@/components/doctor/DoctorAuthScreen';
import { DoctorHome } from '@/components/doctor/DoctorHome';
import { VideoCall } from '@/components/shared/VideoCall';
import { getOrCreateVideoRoom, type VideoRoom } from '@/lib/videoRoom';
import { sendCallInvite } from '@/lib/callInvite';
import { DoctorSchedule } from '@/components/doctor/DoctorSchedule';
import { DoctorPrescriptions } from '@/components/doctor/DoctorPrescriptions';
import { DoctorProfile } from '@/components/doctor/DoctorProfile';
import { PatientDetailDialog } from '@/components/doctor/PatientDetailDialog';
import type { Appointment } from '@/hooks/useAppointments';
import type { Prescription } from '@/hooks/usePrescriptions';
import { DashboardLayout } from '@/components/shared/DashboardLayout';
import { Home, Calendar, History, User } from 'lucide-react';

type DashboardTab = 'home' | 'schedule' | 'patients' | 'profile';

export default function DoctorApp() {
  const { user, isLoading: authLoading, signIn, signOut, hasRole } = useAuth();
  const { doctors, isLoading: doctorsLoading } = useDoctors();
  const {
    doctor: activeDoctor,
    isLoading: doctorLoading,
    refetch: refetchDoctor,
  } = useDoctorByEmail(user?.email);

  // Auto-provision a doctors row on first login for a user that
  // resolved to DOCTOR via the email pattern. Mirrors how PatientApp
  // provisions patients — without this the doctor portal would hang
  // on the auth screen forever for a brand-new doctor account.
  const provisionedRef = useRef(false);
  useEffect(() => {
    if (
      provisionedRef.current ||
      !user?.email ||
      doctorLoading ||
      activeDoctor ||
      !hasRole('DOCTOR')
    ) {
      return;
    }
    provisionedRef.current = true;
    (async () => {
      const md = (user.user_metadata ?? {}) as { full_name?: string };
      const fallbackName =
        md.full_name?.trim() ||
        user.email!.split('@')[0].replace(/\d+$/, '').replace(/^./, (c) => c.toUpperCase());
      await MongoDB.from('doctors').insert({
        full_name: fallbackName,
        email: user.email,
        specialty: 'General Medicine',
        daily_physical_quota: 30,
        daily_video_quota: 10,
        is_active: true,
      });
      await refetchDoctor();
    })();
  }, [user, activeDoctor, doctorLoading, hasRole, refetchDoctor]);

  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { appointments, isLoading: appointmentsLoading, refetch: refetchAppointments } = useDoctorAppointments(activeDoctor?.id, filterDate);
  const { prescriptions, isLoading: prescriptionsLoading, refetch: refetchPrescriptions } = useDoctorPrescriptions(activeDoctor?.id);
  const { updateAppointment } = useUpdateAppointment();

  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [selectedPatient, setSelectedPatient] = useState<Appointment | null>(null);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [consentDialog, setConsentDialog] = useState<Appointment | null>(null);
  const [videoApt, setVideoApt] = useState<Appointment | null>(null);
  const [videoRoomUrl, setVideoRoomUrl] = useState<string | null>(null);
  const [videoProvider, setVideoProvider] = useState<string>('jitsi');
  const [videoRoom, setVideoRoom] = useState<VideoRoom | null>(null);

  // Notify the doctor when a patient declines the incoming video call.
  useEffect(() => {
    const off = onServerEvent('call:declined', (payload: { patientName?: string; reason?: string }) => {
      toast({
        title: 'Patient declined the call',
        description: payload?.reason
          ? `${payload.patientName || 'Patient'}: ${payload.reason}`
          : `${payload?.patientName || 'The patient'} declined the video consultation.`,
        variant: 'destructive',
      });
    });
    return off;
  }, []);

  const handleRealLogin = async (email: string, password: string) => {
    const { error } = await signIn(email, password);
    if (error) throw error;
    toast({ title: 'Welcome!', description: 'Logged in successfully.' });
  };

  const handleLogout = async () => {
    await signOut();
    toast({ title: 'Logged Out' });
  };

  // Create/join the video room, open the call, and ring the patient.
  const handleJoinVideo = async (apt: Appointment) => {
    // Reserve the tab while this click still counts as a user gesture. Browsers
    // commonly block window.open when it is called only after an awaited API request.
    const callWindow = window.open('about:blank', '_blank');
    if (callWindow) {
      callWindow.opener = null;
      callWindow.document.title = 'Preparing video consultation';
      callWindow.document.body.style.cssText = 'margin:0;background:#090909;color:#fff;font:16px system-ui;display:grid;place-items:center;height:100vh';
      callWindow.document.body.textContent = 'Preparing secure video consultation...';
    }

    try {
      const room = await getOrCreateVideoRoom(apt.id);
      const provider = (room.provider || 'webrtc').toLowerCase();

      // Agora runs natively in-portal (the doctor's browser at localhost/https is
      // already a secure context) — render the embedded AgoraCall, don't open the
      // external /video-call page (which needs the patient-facing HTTPS tunnel).
      if (provider !== 'agora' && ['webrtc', 'jitsi'].includes(provider)) {
        if (callWindow) {
          callWindow.location.replace(room.url);
          return;
        }

        // Popup blockers can still intervene. Show a deliberate browser-launch
        // surface instead of attempting camera access inside an iframe.
        setVideoApt(apt);
        setVideoRoomUrl(room.url);
        setVideoProvider(provider);
        return;
      }

      callWindow?.close();
      setVideoApt(apt);
      setVideoRoomUrl(room.url);
      setVideoProvider(provider);
      setVideoRoom(room);
    } catch (err: any) {
      callWindow?.close();
      toast({ title: 'Could not start video', description: err.message, variant: 'destructive' });
      return;
    }

    // Ring the patient (best-effort — they can also Join from their appointments).
    try {
      const { data } = await MongoDB
        .from('patients')
        .select('user_id')
        .eq('id', apt.patient_id)
        .maybeSingle();
      const uid = (data as { user_id?: string } | null)?.user_id;
      if (uid) {
        await sendCallInvite(uid, {
          appointmentId: apt.id,
          fromName: activeDoctor?.name ? `Dr. ${activeDoctor.name}` : 'Your doctor',
          fromRole: 'doctor',
        });
      }
    } catch {
      /* invite is best-effort */
    }
  };

  const handleStartConsultation = async (apt: Appointment) => {
    if (apt.appointment_type === 'video' && !apt.consent_recorded) {
      setConsentDialog(apt);
      return;
    }
    await startConsultation(apt);
  };

  const startConsultation = async (apt: Appointment) => {
    const { error } = await updateAppointment(apt.id, {
      status: 'in_consultation',
      consultation_start_time: new Date().toISOString(),
    });
    if (error) toast({ title: 'Error', description: error, variant: 'destructive' });
    else {
      await MongoDB.from('encounters').insert({
        appointment_id: apt.id,
        doctor_id: apt.doctor_id,
        patient_id: apt.patient_id,
        class: apt.appointment_type === 'video' ? 'VR' : 'AMB',
        started_at: new Date().toISOString(),
      });
      toast({ title: 'Consultation Started', description: `Now seeing ${apt.patient?.name}` });
      refetchAppointments();
    }
  };

  const handleRecordConsent = async () => {
    if (!consentDialog) return;
    await MongoDB.from('appointments').update({
      consent_recorded: true,
      consent_recorded_at: new Date().toISOString(),
    }).eq('id', consentDialog.id);
    await startConsultation(consentDialog);
    setConsentDialog(null);
  };

  const handleCompleteConsultation = async (apt: Appointment) => {
    const { error } = await updateAppointment(apt.id, {
      status: 'completed',
      consultation_end_time: new Date().toISOString(),
    });
    if (error) toast({ title: 'Error', description: error, variant: 'destructive' });
    else {
      await MongoDB.from('encounters').update({
        ended_at: new Date().toISOString(),
      }).eq('appointment_id', apt.id);
      toast({ title: 'Consultation Completed' });
      refetchAppointments();
    }
  };

  if (authLoading || doctorsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <DoctorAuthScreen onRealLogin={handleRealLogin} />;
  }

  // Signed in as DOCTOR but the doctor row isn't loaded yet (or is
  // being auto-provisioned for a brand-new account) — show a spinner
  // rather than bouncing back to the login screen.
  if (!activeDoctor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'schedule', icon: Calendar, label: 'Schedule' },
    { id: 'patients', icon: History, label: 'History' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <DashboardLayout
      role="Doctor"
      userName={activeDoctor.name}
      userSubtitle={activeDoctor.specialty}
      onLogout={handleLogout}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      tabs={tabs}
    >
      {activeTab === 'home' && (
        <DoctorHome
          doctor={activeDoctor}
          appointments={appointments}
          isLoading={appointmentsLoading}
          filterDate={filterDate}
          onFilterDateChange={setFilterDate}
          onViewPatient={setSelectedPatient}
          onStartConsultation={handleStartConsultation}
          onCompleteConsultation={handleCompleteConsultation}
          onJoinVideo={handleJoinVideo}
        />
      )}
      {activeTab === 'schedule' && <DoctorSchedule doctor={activeDoctor} appointments={appointments} />}
      {activeTab === 'patients' && (
        <DoctorPrescriptions prescriptions={prescriptions} isLoading={prescriptionsLoading} onSelect={setSelectedPrescription} />
      )}
      {activeTab === 'profile' && (
        <DoctorProfile doctor={activeDoctor} onLogout={handleLogout} />
      )}

      {/* Video Consultation (full-screen overlay) */}
      {videoApt && videoRoomUrl && (
        <VideoCall
          roomUrl={videoRoomUrl}
          provider={videoProvider}
          appId={videoRoom?.appId}
          channel={videoRoom?.channel}
          agoraToken={videoRoom?.token}
          uid={videoRoom?.uid}
          userName={activeDoctor?.name ? `Dr. ${activeDoctor.name}` : 'Doctor'}
          onEnd={() => { setVideoApt(null); setVideoRoomUrl(null); setVideoRoom(null); refetchAppointments(); }}
        />
      )}

      {/* Patient Detail Dialog */}
      <PatientDetailDialog
        appointment={selectedPatient}
        onClose={() => setSelectedPatient(null)}
        onStatusUpdate={() => { refetchAppointments(); refetchPrescriptions(); }}
        doctorId={activeDoctor.id}
        prescriptions={prescriptions}
        onStartVideo={(apt) => { setSelectedPatient(null); handleJoinVideo(apt); }}
      />

      {/* Prescription Detail Dialog */}
      <Dialog open={!!selectedPrescription} onOpenChange={() => setSelectedPrescription(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Prescription Details</DialogTitle></DialogHeader>
          {selectedPrescription && (
            <div className="space-y-3">
              <div className="p-3 bg-secondary/50 rounded-xl">
                <p className="text-xs text-muted-foreground">Diagnosis</p>
                <p className="font-medium text-sm">{selectedPrescription.diagnosis}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Date</p>
                <p className="font-medium text-sm">{format(new Date(selectedPrescription.created_at), 'MMMM d, yyyy')}</p>
              </div>
              {selectedPrescription.medications && Array.isArray(selectedPrescription.medications) && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Medications</p>
                  {(selectedPrescription.medications as any[]).map((med: any, idx: number) => (
                    <div key={idx} className="p-2 bg-secondary/50 rounded-lg text-sm">
                      <p className="font-medium">{med.name}</p>
                      <p className="text-xs text-muted-foreground">{med.dosage} • {med.frequency} • {med.duration}</p>
                    </div>
                  ))}
                </div>
              )}
              {selectedPrescription.instructions && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Instructions</p>
                  <p className="text-sm">{selectedPrescription.instructions}</p>
                </div>
              )}
              {selectedPrescription.follow_up_date && (
                <div className="p-3 bg-primary/10 rounded-xl">
                  <p className="text-sm font-medium text-primary">
                    Follow-up: {format(new Date(selectedPrescription.follow_up_date), 'MMMM d, yyyy')}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Telemedicine Consent Dialog */}
      <Dialog open={!!consentDialog} onOpenChange={() => setConsentDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Telemedicine Consent Required
            </DialogTitle>
            <DialogDescription>
              Per Sindh telemedicine regulations, explicit patient consent must be recorded before starting a video consultation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="p-3 bg-chart-4/10 rounded-xl border border-chart-4/20 text-sm">
              <p className="font-medium mb-1">Patient: {consentDialog?.patient?.name}</p>
              <p className="text-muted-foreground text-xs">
                By proceeding, you confirm that the patient has given explicit verbal or written consent for this telemedicine consultation, 
                and that your credentials have been verified by the patient.
              </p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-xl text-xs text-muted-foreground">
              <p>• Provider profile and credentials displayed</p>
              <p>• Patient privacy and confidentiality ensured</p>
              <p>• Session will be logged in the EMR</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConsentDialog(null)}>Cancel</Button>
            <Button onClick={handleRecordConsent}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Record Consent & Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
