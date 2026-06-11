import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePatientByAuth, useCreatePatient } from '@/hooks/usePatients';
import { useDoctors } from '@/hooks/useDoctors';
import { useAppointments, useCreateAppointment } from '@/hooks/useAppointments';
import { usePatientPrescriptions } from '@/hooks/usePrescriptions';
import { useAvailableSlots } from '@/hooks/useSlots';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import indusLogo from '@/assets/indus-logo.svg';
import { cn } from '@/lib/utils';
import {
  Calendar as CalendarIcon, Clock, User, FileText, History, Plus, Search,
  LogOut, Stethoscope, Video, MapPin, Phone, Mail, CheckCircle2, AlertCircle,
  Pill, Activity, Home, ArrowLeft, ArrowRight, Check, Eye, QrCode, Loader2,
  ChevronRight
} from 'lucide-react';
import AppointmentQRCode from '@/components/patient/AppointmentQRCode';
import { VideoCall } from '@/components/shared/VideoCall';
import { getOrCreateVideoRoom } from '@/lib/videoRoom';
import { IncomingCallListener } from '@/components/patient/IncomingCallListener';
import { PatientAuthScreen } from '@/components/patient/PatientAuthScreen';
import type { Appointment, Patient } from '@/integrations/mongodb/types';
import type { Prescription } from '@/hooks/usePrescriptions';
import { DashboardLayout } from '@/components/shared/DashboardLayout';

type DashboardTab = 'home' | 'appointments' | 'book' | 'history' | 'profile';
type BookingStep = 'doctor' | 'datetime' | 'confirm';

export default function PatientApp() {
  const { user, isLoading: authLoading, signIn, signUp, signOut } = useAuth();
  const { patient, isLoading: patientLoading, updatePatient, refetch: refetchPatient } = usePatientByAuth(user);
  const { createPatient } = useCreatePatient();
  const { doctors, isLoading: doctorsLoading } = useDoctors();
  const { appointments, loading: appointmentsLoading, fetchAppointments: refetchAppointments } = useAppointments(patient?.id);
  const { prescriptions, isLoading: prescriptionsLoading } = usePatientPrescriptions(patient?.id);
  const { createAppointment, isLoading: bookingLoading } = useCreateAppointment();
  const { slots: availableSlots, isLoading: slotsLoading, fetchSlots } = useAvailableSlots();

  // Dashboard state
  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Booking state
  const [bookingStep, setBookingStep] = useState<BookingStep>('doctor');
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState('');
  const [appointmentType, setAppointmentType] = useState<'physical' | 'video'>('physical');
  const [chiefComplaint, setChiefComplaint] = useState('');

  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [qrAppointment, setQrAppointment] = useState<Appointment | null>(null);
  const [videoApt, setVideoApt] = useState<Appointment | null>(null);
  const [videoRoomUrl, setVideoRoomUrl] = useState<string | null>(null);
  const [videoProvider, setVideoProvider] = useState<string>('jitsi');

  // Success dialog state
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successAppointment, setSuccessAppointment] = useState<{ token: string; doctor: string; date: string; time: string; type: 'physical' | 'video' } | null>(null);

  // First-login provisioning. The signup form already collected the
  // patient's details (stored in MongoDB auth user_metadata), so the
  // patient record is created automatically — there is no separate
  // "complete profile" step.
  const provisionedRef = useRef(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || patientLoading || patient || provisionedRef.current) return;
    provisionedRef.current = true;
    (async () => {
      const md = (user.user_metadata ?? {}) as {
        full_name?: string; phone?: string; age?: number | string; gender?: string;
      };
      const { error } = await createPatient({
        user_id: user.id,
        name: md.full_name || user.email?.split('@')[0] || 'Patient',
        phone: md.phone || '',
        email: user.email || '',
        age: md.age ? Number(md.age) : undefined,
        gender: (md.gender || '').toLowerCase() as 'male' | 'female' | 'other' | undefined,
      });
      if (error) {
        setProvisionError(error.message);
      } else {
        await refetchPatient();
      }
    })();
  }, [user, patient, patientLoading, createPatient, refetchPatient]);

  const filteredAppointments = appointments.filter(apt => {
    if (filterStatus !== 'all' && apt.status !== filterStatus) return false;
    if (searchQuery) {
      const s = searchQuery.toLowerCase();
      const docName = (apt as any).doctors?.full_name?.toLowerCase() ?? '';
      const complaint = apt.chief_complaint?.toLowerCase() ?? '';
      if (!docName.includes(s) && !complaint.includes(s)) return false;
    }
    return true;
  });

  const timeSlots = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];

  // Fetch slots when doctor and date are selected
  useEffect(() => {
    if (selectedDoctor && selectedDate instanceof Date) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      fetchSlots(selectedDoctor, dateStr);
    }
  }, [selectedDoctor, selectedDate]); // Removed fetchSlots from dependencies

  const handleSignIn = async (email: string, password: string) => {
    const { error } = await signIn(email, password);
    if (error) throw error;
    toast({ title: 'Welcome back!', description: 'Logged in successfully.' });
  };

  const handleSignUp = async (email: string, password: string, name: string, phone: string, age?: string, gender?: string) => {
    const { error } = await signUp(email, password, name, phone);
    if (error) throw error;
    toast({ title: 'Account Created!', description: 'Please check your email to verify your account.' });
  };

  const handleLogout = async () => {
    await signOut();
    toast({ title: 'Logged Out' });
  };

  // Join the video room for a video appointment.
  const handleJoinVideo = async (apt: Appointment) => {
    try {
      const room = await getOrCreateVideoRoom(apt.id);
      setVideoApt(apt);
      setVideoRoomUrl(room.url);
      setVideoProvider(room.provider || 'jitsi');
    } catch (err: any) {
      toast({ title: 'Could not join video', description: err.message, variant: 'destructive' });
    }
  };

  const handleBookAppointment = async () => {
    if (!patient) {
      toast({ title: 'Error', description: 'Patient profile not found.', variant: 'destructive' });
      return;
    }
    // Validate the three booking selections.
    if (!selectedDoctor) {
      toast({ title: 'Select a doctor', description: 'Please pick a doctor first.', variant: 'destructive' });
      setBookingStep('doctor');
      return;
    }
    if (!selectedDate) {
      toast({ title: 'Select a date', description: 'Please pick a date.', variant: 'destructive' });
      setBookingStep('datetime');
      return;
    }
    if (!selectedTime) {
      toast({ title: 'Select a time', description: 'Please pick a time slot.', variant: 'destructive' });
      setBookingStep('datetime');
      return;
    }

    const doc = doctors.find(d => d.id === selectedDoctor);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const showSuccess = (token: string) => {
      setSuccessAppointment({
        token,
        doctor: doc?.name || 'Unknown',
        date: format(selectedDate, 'MMM dd, yyyy'),
        time: selectedTime,
        type: appointmentType,
      });
      setShowSuccessDialog(true);
    };

    // Live booking through MongoDB.
    const { data, error } = await createAppointment({
      patient_id: patient.id,
      doctor_id: selectedDoctor,
      appointment_date: dateStr,
      appointment_time: selectedTime,
      appointment_type: appointmentType,
      chief_complaint: chiefComplaint || undefined,
      doctor_specialty: doc?.specialty || 'General Medicine',
    });

    if (error || !data?.token) {
      toast({
        title: 'Booking failed',
        description: error?.message || 'Could not complete your booking. Please try again.',
        variant: 'destructive'
      });
      return;
    }

    showSuccess(data.token);
    refetchAppointments();
  };

  if (authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user) {
    return <PatientAuthScreen onSignIn={handleSignIn} onSignUp={handleSignUp} />;
  }

  // No patient record yet → auto-provisioning in progress (or it
  // failed, e.g. the DB schema isn't deployed). No manual form.
  if (!patient) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="bg-card border-b border-border px-4 py-3 safe-area-top">
          <img src={indusLogo} alt="Indus Hospital" className="h-10 mx-auto" />
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 md:p-8 rounded-2xl border shadow-lg text-center space-y-4">
            {provisionError ? (
              <>
                <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
                <div>
                  <h1 className="text-lg font-bold">Couldn’t set up your account</h1>
                  <p className="text-sm text-muted-foreground mt-1 break-words">{provisionError}</p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" className="rounded-xl" onClick={handleLogout}>Sign out</Button>
                  <Button
                    className="rounded-xl"
                    onClick={() => { setProvisionError(null); provisionedRef.current = false; refetchPatient(); }}
                  >
                    Try again
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Setting up your account…</p>
              </>
            )}
          </Card>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'appointments', icon: CalendarIcon, label: 'Appts' },
    { id: 'book', icon: Plus, label: 'Book' },
    { id: 'history', icon: History, label: 'History' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  // Dashboard
  return (
    <DashboardLayout
      role="Patient"
      userName={patient?.name?.split(' ')[0]}
      userSubtitle={patient?.patient_id}
      onLogout={handleLogout}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      tabs={tabs}
    >
      {/* Home Tab */}
      {activeTab === 'home' && (
        <div className="space-y-4 md:space-y-6">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-4 md:p-6">
            <h2 className="text-lg md:text-2xl font-bold">Welcome, {patient?.name?.split(' ')[0]}!</h2>
            <p className="text-muted-foreground text-sm mt-1">Manage your health journey</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-auto py-3 md:py-4 rounded-xl flex flex-col items-center gap-2"
              onClick={() => setActiveTab('book')}>
              <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Plus className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <span className="text-xs md:text-sm font-medium">Book Appointment</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 md:py-4 rounded-xl flex flex-col items-center gap-2"
              onClick={() => setActiveTab('appointments')}>
              <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-chart-2/10 flex items-center justify-center">
                <CalendarIcon className="h-4 w-4 md:h-5 md:w-5 text-chart-2" />
              </div>
              <span className="text-xs md:text-sm font-medium">My Appointments</span>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Clock, label: 'Upcoming', value: appointments.filter(a => ['confirmed', 'waiting'].includes(a.status)).length, color: 'text-primary', bg: 'bg-primary/10' },
              { icon: CheckCircle2, label: 'Completed', value: appointments.filter(a => a.status === 'completed').length, color: 'text-chart-2', bg: 'bg-chart-2/10' },
              { icon: FileText, label: 'Prescriptions', value: prescriptions.length, color: 'text-chart-3', bg: 'bg-chart-3/10' },
              { icon: Stethoscope, label: 'Doctors', value: doctors.length, color: 'text-chart-4', bg: 'bg-chart-4/10' },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <Card key={label} className="p-3 md:p-4 rounded-xl">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className={cn("h-9 w-9 md:h-10 md:w-10 rounded-lg flex items-center justify-center", bg)}>
                    <Icon className={cn("h-4 w-4 md:h-5 md:w-5", color)} />
                  </div>
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg md:text-xl font-bold">{value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Upcoming Appointments */}
          <Card className="rounded-xl overflow-hidden">
            <div className="p-3 md:p-4 border-b bg-secondary/30 flex items-center justify-between">
              <h3 className="font-medium text-sm md:text-base">Upcoming Appointments</h3>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveTab('appointments')}>View All</Button>
            </div>
            <div className="divide-y">
              {(() => {
                const upcoming = appointments.filter(a => ['confirmed', 'waiting'].includes(a.status));
                if (upcoming.length === 0) {
                  return (
                    <div className="p-6 text-center">
                      <CalendarIcon className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No upcoming appointments</p>
                      <Button className="mt-3" size="sm" onClick={() => setActiveTab('book')}>Book Now</Button>
                    </div>
                  );
                }
                return upcoming.slice(0, 3).map((apt) => {
                  const docName = (apt as any).doctors?.full_name
                    ?? doctors.find(d => d.id === apt.doctor_id)?.name
                    ?? 'Doctor';
                  return (
                    <div key={apt.id} className="p-3 md:p-4 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("h-9 w-9 md:h-10 md:w-10 rounded-xl flex items-center justify-center shrink-0",
                          apt.appointment_type === 'video' ? "bg-chart-2/10" : "bg-primary/10")}>
                          {apt.appointment_type === 'video' ? <Video className="h-4 w-4 text-chart-2" /> : <MapPin className="h-4 w-4 text-primary" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{docName}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(apt.appointment_date), 'MMM d')} • {apt.appointment_time}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant={apt.status === 'waiting' ? 'default' : 'outline'} className="text-xs">
                          {apt.status === 'waiting' ? 'Waiting' : 'Confirmed'}
                        </Badge>
                        {apt.appointment_type === 'physical' && apt.status === 'confirmed' && (
                          <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => setQrAppointment(apt)}>
                            <QrCode className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </Card>
        </div>
      )}

      {/* Appointments Tab */}
      {activeTab === 'appointments' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl h-10" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[140px] rounded-xl h-10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {['all', 'confirmed', 'waiting', 'completed', 'cancelled'].map(s => (
                  <SelectItem key={s} value={s}>{s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {appointmentsLoading && filteredAppointments.length === 0 ? (
            <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
          ) : filteredAppointments.length === 0 ? (
            <div className="p-8 text-center">
              <CalendarIcon className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No appointments found</p>
              <Button className="mt-3" size="sm" onClick={() => setActiveTab('book')}>Book Now</Button>
            </div>
          ) : (
            filteredAppointments.map((apt) => {
              const joined = (apt as any).doctors;
              const docFromList = doctors.find(d => d.id === apt.doctor_id);
              const docName = joined?.full_name ?? docFromList?.name ?? 'Doctor';
              const docSpecialty = joined?.specialty ?? docFromList?.specialty ?? '';
              return (
                <Card key={apt.id} className="p-3 md:p-4 rounded-xl">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("h-10 w-10 md:h-12 md:w-12 rounded-xl flex items-center justify-center shrink-0",
                        apt.appointment_type === 'video' ? "bg-chart-2/10" : "bg-primary/10")}>
                        {apt.appointment_type === 'video' ? <Video className="h-5 w-5 text-chart-2" /> : <MapPin className="h-5 w-5 text-primary" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{docName}</p>
                        <p className="text-xs text-muted-foreground">{docSpecialty}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(apt.appointment_date), 'EEE, MMM d')} • {apt.appointment_time}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={
                        apt.status === 'completed' ? 'default' : apt.status === 'cancelled' ? 'destructive' : 'outline'
                      } className="text-xs">{apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}</Badge>
                      {apt.appointment_type === 'physical' && apt.status === 'confirmed' && (
                        <Button variant="outline" size="sm" className="rounded-lg text-xs h-7" onClick={() => setQrAppointment(apt)}>
                          <QrCode className="h-3 w-3 mr-1" /> QR
                        </Button>
                      )}
                      {apt.appointment_type === 'video' && ['confirmed', 'waiting', 'in_consultation'].includes(apt.status) && (
                        <Button size="sm" className="rounded-lg text-xs h-7" onClick={() => handleJoinVideo(apt)}>
                          <Video className="h-3 w-3 mr-1" /> Join Video
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Book Appointment Tab */}
      {activeTab === 'book' && (
        <div className="space-y-4 md:space-y-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-4 md:mb-8">
            {(['doctor', 'datetime', 'confirm'] as BookingStep[]).map((step, idx) => (
              <div key={step} className="flex items-center">
                <div className={cn("h-7 w-7 md:h-8 md:w-8 rounded-full flex items-center justify-center text-xs md:text-sm font-medium",
                  bookingStep === step ? "bg-primary text-primary-foreground" :
                    (['doctor', 'datetime', 'confirm'].indexOf(bookingStep) > idx) ? "bg-primary text-primary-foreground" :
                      "bg-secondary text-muted-foreground")}>
                  {(['doctor', 'datetime', 'confirm'].indexOf(bookingStep) > idx) ? <Check className="h-3 w-3 md:h-4 md:w-4" /> : idx + 1}
                </div>
                {idx < 2 && <div className={cn("w-8 md:w-12 h-0.5 mx-1",
                  (['doctor', 'datetime', 'confirm'].indexOf(bookingStep) > idx) ? "bg-primary" : "bg-secondary")} />}
              </div>
            ))}
          </div>

          {bookingStep === 'doctor' && (
            <div className="space-y-4">
              <h2 className="text-lg md:text-xl font-bold text-center">Select a Doctor</h2>
              <div className="flex bg-secondary/50 rounded-xl p-1 max-w-xs mx-auto">
                {(['physical', 'video'] as const).map((type) => (
                  <button key={type} onClick={() => setAppointmentType(type)}
                    className={cn("flex-1 py-2 px-3 rounded-lg text-xs md:text-sm font-medium transition-all flex items-center justify-center gap-1",
                      appointmentType === type ? "bg-card shadow" : "text-muted-foreground")}>
                    {type === 'physical' ? <><MapPin className="h-3 w-3" /> In-Person</> : <><Video className="h-3 w-3" /> Video</>}
                  </button>
                ))}
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {doctorsLoading ? (
                  <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
                ) : doctors.length === 0 ? (
                  <div className="p-8 text-center"><p className="text-muted-foreground text-sm">No doctors available</p></div>
                ) : (
                  doctors.map((doc) => (
                    <Card key={doc.id} onClick={() => setSelectedDoctor(doc.id)}
                      className={cn("p-3 md:p-4 rounded-xl cursor-pointer transition-all active:scale-[0.98]",
                        selectedDoctor === doc.id ? "border-primary bg-primary/5" : "hover:border-primary/30")}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Stethoscope className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{doc.specialty}</p>
                          {doc.department && <Badge variant="outline" className="text-[10px] mt-1">{doc.department.name}</Badge>}
                        </div>
                        {selectedDoctor === doc.id && <Check className="h-5 w-5 text-primary shrink-0" />}
                      </div>
                    </Card>
                  ))
                )}
              </div>

              <Button className="w-full rounded-xl h-11" disabled={!selectedDoctor} onClick={() => setBookingStep('datetime')}>
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {bookingStep === 'datetime' && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setBookingStep('doctor')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <h2 className="text-lg md:text-xl font-bold text-center">Select Date & Time</h2>
              <Card className="p-3 md:p-4 rounded-xl overflow-x-auto">
                <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate}
                  disabled={(date) => date < new Date() || date.getDay() === 0} className="rounded-xl mx-auto" />
              </Card>
              {selectedDate && (
                <div className="space-y-2">
                  <Label className="text-sm">Available Slots {slotsLoading && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {(availableSlots.length > 0 ? availableSlots : timeSlots.map((t, i) => ({ id: `f-${i}`, start_time: t, end_time: t, slot_type: 'physical', status: 'free' }))).map((slot) => {
                      const time = typeof slot === 'string' ? slot : slot.start_time;
                      return (
                        <Button key={typeof slot === 'string' ? slot : slot.id} variant={selectedTime === time ? "default" : "outline"}
                          className="rounded-xl text-xs md:text-sm" onClick={() => setSelectedTime(time)}>
                          {time.slice(0, 5)}
                        </Button>
                      );
                    })}
                    {availableSlots.length === 0 && !slotsLoading && selectedDoctor && (
                      <p className="col-span-4 text-center text-xs text-muted-foreground py-2">No slots available for this date</p>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm">Chief Complaint (Optional)</Label>
                <Input placeholder="Describe your symptoms..." value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)} className="rounded-xl" />
              </div>
              <Button className="w-full rounded-xl h-11" disabled={!selectedDate || !selectedTime} onClick={() => setBookingStep('confirm')}>
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {bookingStep === 'confirm' && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setBookingStep('datetime')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <h2 className="text-lg md:text-xl font-bold text-center">Confirm Appointment</h2>
              <Card className="p-4 md:p-6 rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Stethoscope className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{doctors.find(d => d.id === selectedDoctor)?.name}</p>
                    <p className="text-xs text-muted-foreground">{doctors.find(d => d.id === selectedDoctor)?.specialty}</p>
                  </div>
                </div>
                {[
                  { icon: CalendarIcon, text: selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy') },
                  { icon: Clock, text: selectedTime },
                  { icon: appointmentType === 'video' ? Video : MapPin, text: appointmentType === 'video' ? 'Video Consultation' : 'In-Person Visit' },
                ].map(({ icon: Icon, text }, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Icon className="h-4 w-4 text-muted-foreground" /><span>{text}</span>
                  </div>
                ))}
                {chiefComplaint && (
                  <div className="flex items-start gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" /><span>{chiefComplaint}</span>
                  </div>
                )}
              </Card>
              <Button className="w-full rounded-xl h-11" onClick={handleBookAppointment} disabled={bookingLoading}>
                {bookingLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Booking...</> : <><Check className="h-4 w-4 mr-2" /> Confirm Booking</>}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <h2 className="text-lg md:text-xl font-bold">Prescription History</h2>
          {prescriptionsLoading ? (
            <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
          ) : prescriptions.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No prescriptions yet</p>
            </div>
          ) : (
            prescriptions.map((rx) => (
              <Card key={rx.id} className="p-3 md:p-4 rounded-xl cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.98]"
                onClick={() => setSelectedPrescription(rx)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-chart-3/10 flex items-center justify-center shrink-0">
                      <Pill className="h-4 w-4 md:h-5 md:w-5 text-chart-3" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{rx.diagnosis}</p>
                      <p className="text-xs text-muted-foreground">{rx.doctor?.name} • {format(new Date(rx.created_at), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-4">
          <h2 className="text-lg md:text-xl font-bold">My Profile</h2>
          <Card className="p-4 md:p-6 rounded-xl space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-7 w-7 md:h-8 md:w-8 text-primary" />
              </div>
              <div>
                <p className="text-base md:text-lg font-bold">{patient?.name}</p>
                <p className="text-xs md:text-sm text-muted-foreground">{patient?.patient_id}</p>
              </div>
            </div>
            <div className="grid gap-2 md:gap-3">
              {[
                { icon: Phone, label: 'Phone', value: patient?.phone || 'Not provided' },
                { icon: Mail, label: 'Email', value: patient?.email || user?.email || 'Not provided' },
                { icon: User, label: 'Age & Gender', value: `${patient?.age || 'N/A'} • ${patient?.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : 'N/A'}` },
                ...(patient && 'blood_group' in patient && patient.blood_group
                      ? [{ icon: Activity, label: 'Blood Group', value: patient.blood_group }]
                      : []),
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
                  <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium text-sm truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Button variant="outline" className="w-full rounded-xl" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </div>
      )}

      {/* Incoming video-call invite from the doctor */}
      <IncomingCallListener
        userId={user?.id}
        onAccept={(aptId) => {
          const found = appointments.find((a) => a.id === aptId);
          handleJoinVideo(found ?? ({ id: aptId } as unknown as Appointment));
        }}
      />

      {/* Video Consultation (full-screen overlay) */}
      {videoApt && videoRoomUrl && (
        <VideoCall
          roomUrl={videoRoomUrl}
          provider={videoProvider}
          userName={patient?.name || 'Patient'}
          onEnd={() => { setVideoApt(null); setVideoRoomUrl(null); refetchAppointments(); }}
        />
      )}

      {/* QR Code Dialog */}
      {qrAppointment && patient && (
        <AppointmentQRCode open={!!qrAppointment} onClose={() => setQrAppointment(null)}
          appointment={{
            id: qrAppointment.id, token: qrAppointment.token,
            patientId: patient.full_name || '', patientName: patient.full_name || '',
            appointmentTime: qrAppointment.appointment_time,
            appointmentDate: qrAppointment.appointment_date,
            appointmentType: qrAppointment.appointment_type === 'video' ? 'video' : 'visit',
            status: qrAppointment.status,
          }}
          doctor={qrAppointment.doctor ? {
            name: qrAppointment.doctor.name || '', specialty: qrAppointment.doctor.specialty || '', branch: 'Main Building',
          } : undefined}
        />
      )}

      {/* Prescription Detail Dialog */}
      <Dialog open={!!selectedPrescription} onOpenChange={() => setSelectedPrescription(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto p-4 md:p-6">
          <DialogHeader>
            <DialogTitle>Prescription Details</DialogTitle>
            <DialogDescription className="sr-only">
              Diagnosis, prescribing doctor, date, instructions, and any follow-up information for the selected prescription.
            </DialogDescription>
          </DialogHeader>
          {selectedPrescription && (
            <div className="space-y-3">
              <div className="p-3 bg-secondary/50 rounded-xl">
                <p className="text-xs text-muted-foreground">Diagnosis</p>
                <p className="font-medium text-sm">{selectedPrescription.diagnosis}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Doctor</p>
                <p className="font-medium text-sm">{selectedPrescription.doctor?.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Date</p>
                <p className="font-medium text-sm">{format(new Date(selectedPrescription.created_at), 'MMMM d, yyyy')}</p>
              </div>
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

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md rounded-3xl">
          <div className="space-y-4 py-2">
            {/* Success Icon */}
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
            </div>

            {/* Success Message — DialogTitle + DialogDescription satisfy
                Radix's a11y contract while keeping the existing styling. */}
            <DialogHeader className="text-center sm:text-center space-y-1">
              <DialogTitle className="text-xl md:text-2xl font-bold text-green-600">
                Appointment Confirmed!
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Your appointment has been successfully booked
              </DialogDescription>
            </DialogHeader>

            {/* Token Display */}
            {successAppointment && (
              <>
                <Card className="p-4 rounded-xl bg-green-50 border-green-200">
                  <div className="text-center space-y-2">
                    <p className="text-xs text-muted-foreground">Your Token Number</p>
                    <p className="text-3xl md:text-4xl font-bold font-mono tracking-wider text-green-600">
                      {successAppointment.token}
                    </p>
                    <p className="text-xs text-muted-foreground">Save this token for check-in</p>
                  </div>
                </Card>

                {/* Appointment Details */}
                <Card className="p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <Stethoscope className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Doctor</p>
                      <p className="font-medium text-sm">{successAppointment.doctor}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="font-medium text-sm">{successAppointment.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Time</p>
                      <p className="font-medium text-sm">{successAppointment.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {successAppointment.type === 'video' ? (
                      <Video className="h-5 w-5 text-chart-2" />
                    ) : (
                      <MapPin className="h-5 w-5 text-primary" />
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">Type</p>
                      <p className="font-medium text-sm">
                        {successAppointment.type === 'video' ? 'Video Consultation' : 'In-Person Visit'}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* QR Code Section */}
                {successAppointment.type === 'physical' && (
                  <Card className="p-4 rounded-xl bg-secondary/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <QrCode className="h-5 w-5 text-primary" />
                        <span className="text-sm font-medium">QR Code Available</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => {
                          // Find the newly created appointment in either the
                          // live list or the local-mock overlay.
                          const newApt = appointments.find(a => a.token === successAppointment.token);
                          if (newApt) {
                            setQrAppointment(newApt);
                          }
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" /> View QR
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Show this QR code at the hospital kiosk for quick check-in
                    </p>
                  </Card>
                )}

                {/* Action Button */}
                <Button
                  className="w-full rounded-xl h-11"
                  onClick={() => {
                    setShowSuccessDialog(false);
                    setSuccessAppointment(null);
                    // Reset booking form
                    setBookingStep('doctor');
                    setSelectedDoctor(null);
                    setSelectedDate(undefined);
                    setSelectedTime('');
                    setChiefComplaint('');
                    // Go to appointments tab
                    setActiveTab('appointments');
                  }}
                >
                  Go to Dashboard
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
