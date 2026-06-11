import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDoctors, useDoctorByUserId } from '@/hooks/useDoctors';
import { useDoctorAppointments, useUpdateAppointment } from '@/hooks/useAppointments';
import { useDoctorPrescriptions } from '@/hooks/usePrescriptions';
import { MongoDB } from '@/integrations/mongodb/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Loader2, ShieldCheck } from 'lucide-react';
import { DoctorAuthScreen } from '@/components/doctor/DoctorAuthScreen';
import { DoctorHome } from '@/components/doctor/DoctorHome';
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
  const { user, isLoading: authLoading, signIn, signOut } = useAuth();
  const { doctors, isLoading: doctorsLoading } = useDoctors();
  const { doctor } = useDoctorByUserId(user?.id);

  const activeDoctor = doctor;

  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { appointments, isLoading: appointmentsLoading, refetch: refetchAppointments } = useDoctorAppointments(activeDoctor?.id, filterDate);
  const { prescriptions, isLoading: prescriptionsLoading, refetch: refetchPrescriptions } = useDoctorPrescriptions(activeDoctor?.id);
  const { updateAppointment } = useUpdateAppointment();

  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [selectedPatient, setSelectedPatient] = useState<Appointment | null>(null);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [consentDialog, setConsentDialog] = useState<Appointment | null>(null);

  const handleRealLogin = async (email: string, password: string) => {
    const { error } = await signIn(email, password);
    if (error) throw error;
    toast({ title: 'Welcome!', description: 'Logged in successfully.' });
  };

  const handleLogout = async () => {
    await signOut();
    toast({ title: 'Logged Out' });
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
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
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

  const showDashboard = user && doctor;

  if (!showDashboard) {
    return (
      <DoctorAuthScreen
        doctors={doctors}
        onDemoLogin={() => {}}
        onRealLogin={handleRealLogin}
      />
    );
  }

  if (!activeDoctor) return null;

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
        />
      )}
      {activeTab === 'schedule' && <DoctorSchedule doctor={activeDoctor} appointments={appointments} />}
      {activeTab === 'patients' && (
        <DoctorPrescriptions prescriptions={prescriptions} isLoading={prescriptionsLoading} onSelect={setSelectedPrescription} />
      )}
      {activeTab === 'profile' && (
        <DoctorProfile doctor={activeDoctor} onLogout={handleLogout} />
      )}

      {/* Patient Detail Dialog */}
      <PatientDetailDialog
        appointment={selectedPatient}
        onClose={() => setSelectedPatient(null)}
        onStatusUpdate={() => { refetchAppointments(); refetchPrescriptions(); }}
        doctorId={activeDoctor.id}
        prescriptions={prescriptions}
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
