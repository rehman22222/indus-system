import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { MongoDB } from '@/integrations/mongodb/client';
import {
  User, PlayCircle, CheckCircle2, Pill, Plus, Trash2, Loader2, FileText,
  Phone, Mail, MapPin, Heart, AlertTriangle, Activity, Droplets, Shield,
  Video, Thermometer, StickyNote, Paperclip, ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/hooks/useAppointments';
import type { Prescription } from '@/hooks/usePrescriptions';
import {
  listMedicalDocuments,
  openMedicalDocument,
  type MedicalDocument,
} from '@/services/documentService';

interface MedicationItem {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface PatientDetailDialogProps {
  appointment: Appointment | null;
  onClose: () => void;
  onStatusUpdate: () => void;
  doctorId: string;
  prescriptions: Prescription[];
  /** Start/join the video consultation for this appointment. */
  onStartVideo?: (appointment: Appointment) => void;
}

function formatDisplayValue(value: unknown, fallback = 'Not recorded'): string {
  if (value === null || value === undefined || value === '') return fallback;

  if (Array.isArray(value)) {
    const items = value.map((item) => formatDisplayValue(item, '')).filter(Boolean);
    return items.length > 0 ? items.join(', ') : fallback;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, entryValue]) => {
        const formatted = formatDisplayValue(entryValue, '');
        if (!formatted) return null;
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
        return `${label}: ${formatted}`;
      })
      .filter(Boolean);

    return entries.length > 0 ? entries.join(' | ') : fallback;
  }

  return String(value);
}

function formatDateSafe(value?: string | null, pattern = 'MMM d, yyyy') {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : format(date, pattern);
}

function calculateAge(dob?: string | null) {
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function titleCase(value?: string | null) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatStatus(value: string) {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusBadgeClass(status: string) {
  if (status === 'completed') return 'bg-emerald-600 text-white';
  if (status === 'waiting' || status === 'confirmed') return 'bg-primary text-white';
  if (status === 'in_consultation' || status === 'in-progress') return 'bg-blue-600 text-white';
  if (status === 'cancelled' || status === 'no_show' || status === 'no-show') return 'bg-slate-700 text-white';
  return 'bg-slate-800 text-white';
}

function formatFileSize(size?: number) {
  if (!size) return 'Size unavailable';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function PatientDetailDialog({ appointment, onClose, onStatusUpdate, doctorId, prescriptions, onStartVideo }: PatientDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('details');
  const [diagnosis, setDiagnosis] = useState('');
  const [instructions, setInstructions] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [consultationNotes, setConsultationNotes] = useState('');
  const [medications, setMedications] = useState<MedicationItem[]>([
    { name: '', dosage: '', frequency: '', duration: '', instructions: '' }
  ]);
  const [saving, setSaving] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Past visits state
  const [pastVisits, setPastVisits] = useState<any[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);
  const [pastLoaded, setPastLoaded] = useState(false);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  const loadDocuments = useCallback(async () => {
    if (!appointment?.patient_id) return;
    setLoadingDocuments(true);
    try {
      setDocuments(await listMedicalDocuments(appointment.patient_id));
    } catch (error) {
      console.error('Error loading patient documents:', error);
      setDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  }, [appointment?.patient_id]);

  useEffect(() => {
    setConsultationNotes(appointment?.notes || '');
    setActiveTab('details');
    setPastVisits([]);
    setPastLoaded(false);
    setDocuments([]);
    loadDocuments();
  }, [appointment?.id, appointment?.notes, loadDocuments]);

  useEffect(() => {
    if (!appointment?.id || !doctorId) return undefined;
    const channel = MongoDB
      .channel(`queue:${doctorId}`)
      .on('documents.updated', {}, (event: any) => {
        const payload = event?.payload || event?.new || event;
        if (!payload?.appointment_id || payload.appointment_id === appointment.id) loadDocuments();
      })
      .subscribe();

    return () => {
      MongoDB.removeChannel(channel);
    };
  }, [appointment?.id, doctorId, loadDocuments]);

  if (!appointment) return null;

  const patient = appointment.patient;
  const vitals = appointment.vitals as Record<string, string> | null;
  const patientName = patient?.name || patient?.full_name || 'Unknown Patient';
  const patientCode = patient?.patient_id || patient?.id || 'N/A';
  const patientAge = patient?.age ?? calculateAge(patient?.dob);
  const patientGender = titleCase(patient?.gender || patient?.sex);
  const medicalHistory = formatDisplayValue(patient?.medical_history, '');
  const emergencyContact = formatDisplayValue(patient?.emergency_contact, '');
  const AppointmentTypeIcon = appointment.appointment_type === 'video' ? Video : MapPin;
  const currentDocuments = documents.filter((document) => document.appointment_id === appointment.id);

  const patientPrescriptions = prescriptions.filter(
    (rx: any) =>
      rx.patient_id === appointment.patient_id ||
      rx.patient?.id === appointment.patient_id ||
      rx.patient?.patient_id === patientCode
  );

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'in_consultation') updates.consultation_start_time = new Date().toISOString();
      if (newStatus === 'completed') updates.consultation_end_time = new Date().toISOString();
      const { error } = await MongoDB.from('appointments').update(updates as any).eq('id', appointment.id);
      if (error) throw error;
      toast({ title: 'Status Updated', description: `Patient marked as ${newStatus.replace('_', ' ')}` });
      onStatusUpdate();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!consultationNotes.trim()) return;
    setSavingNotes(true);
    try {
      const { error } = await MongoDB.from('appointments').update({
        notes: consultationNotes,
      } as any).eq('id', appointment.id);
      if (error) throw error;
      toast({ title: 'Notes Saved', description: 'Consultation notes saved successfully' });
      onStatusUpdate();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingNotes(false);
    }
  };

  const addMedication = () => setMedications([...medications, { name: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
  const removeMedication = (idx: number) => setMedications(medications.filter((_, i) => i !== idx));
  const updateMedication = (idx: number, field: keyof MedicationItem, value: string) => {
    const updated = [...medications];
    updated[idx] = { ...updated[idx], [field]: value };
    setMedications(updated);
  };

  const handleSavePrescription = async () => {
    if (!diagnosis.trim()) { toast({ title: 'Error', description: 'Please enter a diagnosis', variant: 'destructive' }); return; }
    if (medications.some(m => !m.name || !m.dosage)) { toast({ title: 'Error', description: 'Please fill medication name and dosage', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const { error } = await MongoDB.from('prescriptions').insert({
        appointment_id: appointment.id, patient_id: appointment.patient_id, doctor_id: doctorId,
        diagnosis, medications: medications as any, instructions: instructions || null, follow_up_date: followUpDate || null,
      });
      if (error) throw error;
      toast({ title: 'Prescription Saved' });
      setDiagnosis(''); setInstructions(''); setFollowUpDate('');
      setMedications([{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
      setActiveTab('details');
      onStatusUpdate();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Load past visits from DB
  const loadPastVisits = async () => {
    if (pastLoaded || !appointment.patient_id) return;
    setLoadingPast(true);
    try {
      const { data, error } = await MongoDB
        .from('appointments')
        .select(`
          id, appointment_date, appointment_time, status, chief_complaint, notes,
          doctor:doctors(full_name, specialty),
          prescriptions:prescriptions(id, diagnosis, medications, instructions, follow_up_date, created_at)
        `)
        .eq('patient_id', appointment.patient_id)
        .neq('id', appointment.id)
        .in('status', ['completed', 'in_consultation'])
        .order('appointment_date', { ascending: false })
        .limit(20);

      if (error) throw error;
      setPastVisits(data || []);
      setPastLoaded(true);
    } catch (err) {
      console.error('Error loading past visits:', err);
    } finally {
      setLoadingPast(false);
    }
  };

  // Load past visits when switching to history tab
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'history') loadPastVisits();
  };

  return (
    <Dialog open={!!appointment} onOpenChange={() => onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[92vh] p-0 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-2xl sm:rounded-2xl [&>button]:right-5 [&>button]:top-5 [&>button]:rounded-full [&>button]:bg-white/90 [&>button]:p-1.5 [&>button]:shadow-sm [&>button]:ring-1 [&>button]:ring-slate-200">
        <DialogTitle className="sr-only">Patient details for {patientName}</DialogTitle>
        {/* Patient Header */}
        <div className="relative overflow-hidden border-b border-slate-200 bg-white">
          <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
          <div className="p-5 pr-14 sm:p-6 sm:pr-16">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <User className="h-8 w-8" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="truncate text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{patientName}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full border-slate-300 bg-white px-3 py-1 font-mono text-[11px] text-slate-700">{patientCode}</Badge>
                <Badge variant="outline" className="rounded-full border-slate-300 bg-white px-3 py-1 font-mono text-[11px] text-slate-700">{appointment.token}</Badge>
                <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-medium text-blue-700">
                  <AppointmentTypeIcon className="mr-1.5 h-3.5 w-3.5" />
                  {appointment.appointment_type === 'video' ? 'Video' : 'Physical'}
                </Badge>
                <Badge variant="outline" className="rounded-full border-slate-300 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700">
                  {appointment.visit_type === 'follow_up' ? 'Follow-up consultation' : 'Initial consultation'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {patientAge !== null && <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">{patientAge} yrs</span>}
            {!patient?.gender && patientGender && <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">Gender: {patientGender}</span>}
            {patient?.gender && <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">{patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}</span>}
            {patient?.blood_group && <span className="rounded-full bg-red-50 px-3 py-1 font-semibold text-primary">{patient.blood_group}</span>}
            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">{appointment.appointment_time}</span>
          </div>
          {/* Status Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {appointment.appointment_type === 'video' && onStartVideo &&
              ['scheduled', 'confirmed', 'waiting', 'in_consultation'].includes(appointment.status) && (
              <Button
                className="h-10 rounded-lg bg-emerald-600 px-4 text-sm text-white shadow-sm hover:bg-emerald-700"
                onClick={() => onStartVideo(appointment)}
              >
                <Video className="h-3.5 w-3.5 mr-1" /> Start Video Call
              </Button>
            )}
            {appointment.status === 'waiting' && (
              <Button className="h-10 rounded-lg px-4 text-sm shadow-sm" onClick={() => handleStatusUpdate('in_consultation')} disabled={updatingStatus}>
                <PlayCircle className="h-3.5 w-3.5 mr-1" /> Start Consultation
              </Button>
            )}
            {appointment.status === 'in_consultation' && (
              <Button className="h-10 rounded-lg px-4 text-sm shadow-sm" onClick={() => handleStatusUpdate('completed')} disabled={updatingStatus}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Complete
              </Button>
            )}
            <Badge className={cn('ml-auto rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm', statusBadgeClass(appointment.status))}>
              {formatStatus(appointment.status)}
            </Badge>
          </div>
        </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex min-h-0 flex-1 flex-col bg-slate-50">
          <TabsList className="mx-5 mt-4 grid h-11 grid-cols-6 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <TabsTrigger value="details" className="rounded-lg text-[11px] font-medium text-slate-600 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm sm:text-xs">Details</TabsTrigger>
            <TabsTrigger value="vitals" className="rounded-lg text-[11px] font-medium text-slate-600 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm sm:text-xs">Vitals</TabsTrigger>
            <TabsTrigger value="notes" className="rounded-lg text-[11px] font-medium text-slate-600 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm sm:text-xs">Notes</TabsTrigger>
            <TabsTrigger value="prescribe" className="rounded-lg text-[11px] font-medium text-slate-600 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm sm:text-xs">Prescribe</TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg text-[11px] font-medium text-slate-600 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm sm:text-xs">History</TabsTrigger>
            <TabsTrigger value="documents" className="rounded-lg text-[10px] font-medium text-slate-600 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm sm:text-xs">Documents</TabsTrigger>
          </TabsList>

          <div className="max-h-[56vh] overflow-y-auto">
            {/* Details Tab */}
            <TabsContent value="details" className="mt-0 space-y-5 p-5">
              {appointment.chief_complaint && (
                <Card className="rounded-xl border-red-200 bg-red-50 p-4 shadow-none">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary ring-1 ring-red-100">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Chief Complaint</p>
                      <p className="mt-1 text-sm leading-6 text-slate-800">{appointment.chief_complaint}</p>
                    </div>
                  </div>
                </Card>
              )}
              {appointment.history_summary && (
                <Card className="rounded-xl border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Patient-provided history</p>
                      <p className="mt-1 text-sm leading-6 text-slate-800">{appointment.history_summary}</p>
                    </div>
                  </div>
                </Card>
              )}
              {currentDocuments.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('documents')}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-primary/40"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Paperclip className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">Patient attachments</span>
                      <span className="block text-xs text-slate-500">{currentDocuments.length} file{currentDocuments.length === 1 ? '' : 's'} supplied for this booking</span>
                    </span>
                  </span>
                  <ExternalLink className="h-4 w-4 text-slate-400" />
                </button>
              )}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { icon: Phone, label: 'Phone', value: patient?.phone },
                    { icon: Mail, label: 'Email', value: patient?.email },
                    { icon: MapPin, label: 'Address', value: patient?.address },
                  ].filter(i => i.value).map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-slate-500">{label}</p>
                        <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Medical Info</h4>
                {patient?.allergies && patient.allergies.length > 0 && (
                  <Card className="rounded-xl border-red-200 bg-red-50 p-4 shadow-none">
                    <div className="flex items-start gap-3">
                      <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="text-xs font-semibold text-primary">Allergies</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {patient.allergies.map((a, i) => <Badge key={i} variant="destructive" className="text-[10px]">{a}</Badge>)}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
                {patient?.current_medications && patient.current_medications.length > 0 && (
                  <Card className="rounded-xl border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <Pill className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="text-xs font-semibold text-primary">Current Medications</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {patient.current_medications.map((m, i) => <Badge key={i} variant="secondary" className="text-[10px]">{m}</Badge>)}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
                {medicalHistory && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Medical History</p>
                    <p className="mt-1 text-sm leading-6 text-slate-900">{medicalHistory}</p>
                  </div>
                )}
                {emergencyContact && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Emergency Contact</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-900">{emergencyContact}</p>
                    {patient.emergency_phone && <p className="text-xs text-slate-500">{patient.emergency_phone}</p>}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Vitals Tab */}
            <TabsContent value="vitals" className="mt-0 space-y-3 p-5">
              {vitals ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { icon: Heart, label: 'Blood Pressure', value: vitals.bp, unit: 'mmHg', color: 'text-destructive', bg: 'bg-destructive/10' },
                    { icon: Activity, label: 'Pulse Rate', value: vitals.pulse, unit: 'bpm', color: 'text-primary', bg: 'bg-primary/10' },
                    { icon: Thermometer, label: 'Temperature', value: vitals.temp, unit: '°F', color: 'text-chart-4', bg: 'bg-chart-4/10' },
                    { icon: Droplets, label: 'SpO2', value: vitals.spo2, unit: '%', color: 'text-chart-2', bg: 'bg-chart-2/10' },
                    { icon: User, label: 'Weight', value: vitals.weight, unit: 'kg', color: 'text-chart-3', bg: 'bg-chart-3/10' },
                  ].filter(v => v.value).map(({ icon: Icon, label, value, unit, color, bg }) => (
                    <Card key={label} className="rounded-xl border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <div className={cn("h-11 w-11 rounded-lg flex items-center justify-center shrink-0", bg)}>
                          <Icon className={cn("h-5 w-5", color)} />
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-slate-500">{label}</p>
                          <p className="text-lg font-semibold text-slate-950">{value} <span className="text-xs font-normal text-slate-500">{unit}</span></p>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {patient?.blood_group && (
                    <Card className="rounded-xl border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="h-11 w-11 rounded-lg flex items-center justify-center bg-destructive/10 shrink-0">
                          <Droplets className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-slate-500">Blood Group</p>
                          <p className="text-lg font-semibold text-slate-950">{patient.blood_group}</p>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                  <Activity className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-800">Vitals not recorded yet</p>
                  <p className="mt-1 text-xs text-slate-500">Vitals are taken at check-in</p>
                </div>
              )}
            </TabsContent>

            {/* Notes Tab - NEW */}
            <TabsContent value="notes" className="mt-0 space-y-4 p-5">
              <div className="mb-2 flex items-center gap-2">
                <StickyNote className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-semibold text-slate-900">Consultation Notes</h3>
              </div>
              <Textarea
                placeholder="Enter consultation notes, observations, clinical findings..."
                value={consultationNotes}
                onChange={(e) => setConsultationNotes(e.target.value)}
                className="min-h-[220px] rounded-xl border-slate-200 bg-white text-sm text-slate-900 shadow-sm"
              />
              <Button className="h-10 w-full rounded-lg shadow-sm" onClick={handleSaveNotes} disabled={savingNotes || !consultationNotes.trim()}>
                {savingNotes ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><StickyNote className="h-4 w-4 mr-2" /> Save Notes</>}
              </Button>
              {appointment.notes && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Saved Notes</p>
                  <p className="text-sm leading-6 text-slate-900">{appointment.notes}</p>
                </div>
              )}
            </TabsContent>

            {/* Prescribe Tab */}
            <TabsContent value="prescribe" className="mt-0 space-y-4 p-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">Diagnosis *</Label>
                <Input placeholder="Enter diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className="rounded-xl border-slate-200 bg-white shadow-sm" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-slate-800">Medications</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addMedication} className="h-8 rounded-lg border-slate-200 bg-white text-xs shadow-sm">
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                {medications.map((med, idx) => (
                  <Card key={idx} className="space-y-3 rounded-xl border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Med {idx + 1}</span>
                      {medications.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeMedication(idx)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <Input placeholder="Name" value={med.name} onChange={(e) => updateMedication(idx, 'name', e.target.value)} className="h-9 rounded-lg border-slate-200 bg-white text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Dosage" value={med.dosage} onChange={(e) => updateMedication(idx, 'dosage', e.target.value)} className="h-9 rounded-lg border-slate-200 bg-white text-sm" />
                      <Input placeholder="Frequency" value={med.frequency} onChange={(e) => updateMedication(idx, 'frequency', e.target.value)} className="h-9 rounded-lg border-slate-200 bg-white text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Duration" value={med.duration} onChange={(e) => updateMedication(idx, 'duration', e.target.value)} className="h-9 rounded-lg border-slate-200 bg-white text-sm" />
                      <Input placeholder="Instructions" value={med.instructions} onChange={(e) => updateMedication(idx, 'instructions', e.target.value)} className="h-9 rounded-lg border-slate-200 bg-white text-sm" />
                    </div>
                  </Card>
                ))}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">Instructions</Label>
                <Textarea placeholder="Additional instructions..." value={instructions} onChange={(e) => setInstructions(e.target.value)} className="min-h-20 rounded-xl border-slate-200 bg-white text-sm shadow-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">Follow-up Date</Label>
                <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="rounded-xl border-slate-200 bg-white shadow-sm" />
              </div>
              <Button className="h-10 w-full rounded-lg shadow-sm" onClick={handleSavePrescription} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><Pill className="h-4 w-4 mr-2" /> Save Prescription</>}
              </Button>
            </TabsContent>

            {/* History Tab - Real DB data */}
            <TabsContent value="history" className="mt-0 space-y-4 p-5">
              {loadingPast ? (
                <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
              ) : (
                <>
                  {/* Current visit prescriptions */}
                  {patientPrescriptions.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">This Visit</h4>
                      {patientPrescriptions.map((rx) => {
                        const meds = Array.isArray(rx.medications) ? rx.medications as MedicationItem[] : [];
                        return (
                          <Card key={rx.id} className="space-y-3 rounded-xl border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{rx.diagnosis}</p>
                                <p className="text-xs text-slate-500">{formatDateSafe(rx.created_at)}</p>
                              </div>
                            </div>
                            {meds.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {meds.map((m, i) => <Badge key={i} variant="secondary" className="text-[10px]">{m.name} {m.dosage}</Badge>)}
                              </div>
                            )}
                            {rx.instructions && <p className="text-xs leading-5 text-slate-600">{rx.instructions}</p>}
                            {rx.follow_up_date && <p className="text-xs font-semibold text-primary">Follow-up: {formatDateSafe(rx.follow_up_date)}</p>}
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {/* Past visits */}
                  {pastVisits.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Past Visits</h4>
                      {pastVisits.map((visit) => {
                        const visitPrescriptions = visit.prescriptions || [];
                        return (
                          <Card key={visit.id} className="space-y-3 rounded-xl border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{formatDateSafe(visit.appointment_date)}</p>
                                <p className="text-xs text-slate-500">
                                  {(visit.doctor as any)?.name} • {(visit.doctor as any)?.specialty}
                                </p>
                              </div>
                              <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-2.5 py-1 text-[10px] text-slate-600">{formatStatus(visit.status)}</Badge>
                            </div>
                            {visit.chief_complaint && (
                              <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">{visit.chief_complaint}</p>
                            )}
                            {visit.notes && (
                              <div className="flex items-start gap-1.5">
                                <StickyNote className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                                <p className="text-xs leading-5 text-slate-700">{visit.notes}</p>
                              </div>
                            )}
                            {visitPrescriptions.map((rx: any) => {
                              const meds = Array.isArray(rx.medications) ? rx.medications as MedicationItem[] : [];
                              return (
                                <div key={rx.id} className="space-y-1 border-l-2 border-primary/20 pl-3">
                                  <p className="text-xs font-semibold text-slate-900">{rx.diagnosis}</p>
                                  {meds.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {meds.map((m, i) => <Badge key={i} variant="secondary" className="text-[10px]">{m.name} {m.dosage}</Badge>)}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {patientPrescriptions.length === 0 && pastVisits.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                      <FileText className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                      <p className="text-sm font-semibold text-slate-800">No visit history found</p>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="documents" className="mt-0 space-y-4 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Reports and previous prescriptions</h3>
                  <p className="mt-1 text-xs text-slate-500">Files uploaded by the patient, newest first</p>
                </div>
                <Button variant="outline" size="sm" onClick={loadDocuments} disabled={loadingDocuments}>
                  {loadingDocuments ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                </Button>
              </div>

              {loadingDocuments && documents.length === 0 ? (
                <div className="p-8 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></div>
              ) : documents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                  <Paperclip className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-800">No documents uploaded</p>
                  <p className="mt-1 text-xs text-slate-500">Patient reports and prescriptions will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((document) => {
                    const belongsToCurrentVisit = document.appointment_id === appointment.id;
                    return (
                      <Card key={document.id} className="flex items-center gap-3 rounded-xl border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          {document.kind === 'prescription' ? <Pill className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {document.original_name || document.title}
                            </p>
                            {belongsToCurrentVisit && <Badge className="rounded-full text-[10px]">This booking</Badge>}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {document.kind === 'prescription' ? 'Previous prescription' : 'Medical report'} · {formatFileSize(document.size)} · {formatDateSafe(document.created_at)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={async () => {
                            try {
                              await openMedicalDocument(document.id);
                            } catch (error: any) {
                              toast({ title: 'Could not open document', description: error.message, variant: 'destructive' });
                            }
                          }}
                        >
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
