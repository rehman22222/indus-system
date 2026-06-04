import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  User, PlayCircle, CheckCircle2, Pill, Plus, Trash2, Loader2, FileText,
  Phone, Mail, MapPin, Heart, AlertTriangle, Activity, Droplets, Shield,
  Video, Thermometer, StickyNote
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/hooks/useAppointments';
import type { Prescription } from '@/hooks/usePrescriptions';

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
}

export function PatientDetailDialog({ appointment, onClose, onStatusUpdate, doctorId, prescriptions }: PatientDetailDialogProps) {
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

  if (!appointment) return null;

  const patient = appointment.patient;
  const vitals = appointment.vitals as Record<string, string> | null;

  const patientPrescriptions = prescriptions.filter(
    (rx: any) => rx.patient?.id === appointment.patient_id || rx.patient?.patient_id === patient?.patient_id
  );

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'in_consultation') updates.consultation_start_time = new Date().toISOString();
      if (newStatus === 'completed') updates.consultation_end_time = new Date().toISOString();
      const { error } = await supabase.from('appointments').update(updates as any).eq('id', appointment.id);
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
      const { error } = await supabase.from('appointments').update({
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
      const { error } = await supabase.from('prescriptions').insert({
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
      const { data, error } = await supabase
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

  // Initialize notes from appointment
  if (appointment.notes && !consultationNotes && activeTab !== 'notes') {
    setConsultationNotes(appointment.notes);
  }

  return (
    <Dialog open={!!appointment} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 overflow-hidden rounded-2xl">
        {/* Patient Header */}
        <div className="p-4 md:p-5 border-b bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-base md:text-lg truncate">{patient?.name}</h2>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <Badge variant="outline" className="text-[10px] font-mono">{patient?.patient_id}</Badge>
                <Badge variant="outline" className="text-[10px]">{appointment.token}</Badge>
                <Badge variant={appointment.appointment_type === 'video' ? 'secondary' : 'outline'} className="text-[10px]">
                  {appointment.appointment_type === 'video' ? '📹 Video' : '🏥 Physical'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
            {patient?.age && <span>{patient.age} yrs</span>}
            {patient?.gender && <span>• {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}</span>}
            {patient?.blood_group && <span className="text-destructive font-medium">• 🩸 {patient.blood_group}</span>}
            <span>• {appointment.appointment_time}</span>
          </div>
          {/* Status Actions */}
          <div className="flex gap-2 mt-3">
            {appointment.status === 'waiting' && (
              <Button className="flex-1 rounded-xl h-9 text-xs" onClick={() => handleStatusUpdate('in_consultation')} disabled={updatingStatus}>
                <PlayCircle className="h-3.5 w-3.5 mr-1" /> Start Consultation
              </Button>
            )}
            {appointment.status === 'in_consultation' && (
              <Button className="flex-1 rounded-xl h-9 text-xs" onClick={() => handleStatusUpdate('completed')} disabled={updatingStatus}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Complete
              </Button>
            )}
            <Badge className="ml-auto">{appointment.status.replace('_', ' ')}</Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1">
          <TabsList className="grid w-full grid-cols-5 h-9 mx-4 mt-2" style={{ width: 'calc(100% - 2rem)' }}>
            <TabsTrigger value="details" className="text-[11px]">Details</TabsTrigger>
            <TabsTrigger value="vitals" className="text-[11px]">Vitals</TabsTrigger>
            <TabsTrigger value="notes" className="text-[11px]">Notes</TabsTrigger>
            <TabsTrigger value="prescribe" className="text-[11px]">Prescribe</TabsTrigger>
            <TabsTrigger value="history" className="text-[11px]">History</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[45vh] md:h-[50vh]">
            {/* Details Tab */}
            <TabsContent value="details" className="p-4 space-y-3 mt-0">
              {appointment.chief_complaint && (
                <Card className="p-3 rounded-xl border-destructive/30 bg-destructive/5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-destructive">Chief Complaint</p>
                      <p className="text-sm mt-0.5">{appointment.chief_complaint}</p>
                    </div>
                  </div>
                </Card>
              )}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</h4>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { icon: Phone, label: 'Phone', value: patient?.phone },
                    { icon: Mail, label: 'Email', value: patient?.email },
                    { icon: MapPin, label: 'Address', value: patient?.address },
                  ].filter(i => i.value).map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-2 p-2.5 bg-secondary/50 rounded-xl">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                        <p className="text-sm font-medium truncate">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Medical Info</h4>
                {patient?.allergies && patient.allergies.length > 0 && (
                  <Card className="p-3 rounded-xl border-destructive/30 bg-destructive/5">
                    <div className="flex items-start gap-2">
                      <Shield className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-destructive">Allergies</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {patient.allergies.map((a, i) => <Badge key={i} variant="destructive" className="text-[10px]">{a}</Badge>)}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
                {patient?.current_medications && patient.current_medications.length > 0 && (
                  <Card className="p-3 rounded-xl">
                    <div className="flex items-start gap-2">
                      <Pill className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-primary">Current Medications</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {patient.current_medications.map((m, i) => <Badge key={i} variant="secondary" className="text-[10px]">{m}</Badge>)}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
                {patient?.medical_history && (
                  <div className="p-3 bg-secondary/50 rounded-xl">
                    <p className="text-xs font-medium text-muted-foreground">Medical History</p>
                    <p className="text-sm mt-0.5">{patient.medical_history}</p>
                  </div>
                )}
                {patient?.emergency_contact && (
                  <div className="p-3 bg-secondary/50 rounded-xl">
                    <p className="text-xs font-medium text-muted-foreground">Emergency Contact</p>
                    <p className="text-sm font-medium mt-0.5">{patient.emergency_contact}</p>
                    {patient.emergency_phone && <p className="text-xs text-muted-foreground">{patient.emergency_phone}</p>}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Vitals Tab */}
            <TabsContent value="vitals" className="p-4 space-y-3 mt-0">
              {vitals ? (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Heart, label: 'Blood Pressure', value: vitals.bp, unit: 'mmHg', color: 'text-destructive', bg: 'bg-destructive/10' },
                    { icon: Activity, label: 'Pulse Rate', value: vitals.pulse, unit: 'bpm', color: 'text-primary', bg: 'bg-primary/10' },
                    { icon: Thermometer, label: 'Temperature', value: vitals.temp, unit: '°F', color: 'text-chart-4', bg: 'bg-chart-4/10' },
                    { icon: Droplets, label: 'SpO2', value: vitals.spo2, unit: '%', color: 'text-chart-2', bg: 'bg-chart-2/10' },
                    { icon: User, label: 'Weight', value: vitals.weight, unit: 'kg', color: 'text-chart-3', bg: 'bg-chart-3/10' },
                  ].filter(v => v.value).map(({ icon: Icon, label, value, unit, color, bg }) => (
                    <Card key={label} className="p-3 rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", bg)}>
                          <Icon className={cn("h-5 w-5", color)} />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                          <p className="text-base font-bold">{value} <span className="text-xs font-normal text-muted-foreground">{unit}</span></p>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {patient?.blood_group && (
                    <Card className="p-3 rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-destructive/10 shrink-0">
                          <Droplets className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Blood Group</p>
                          <p className="text-base font-bold">{patient.blood_group}</p>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">Vitals not recorded yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Vitals are taken at check-in</p>
                </div>
              )}
            </TabsContent>

            {/* Notes Tab - NEW */}
            <TabsContent value="notes" className="p-4 space-y-3 mt-0">
              <div className="flex items-center gap-2 mb-2">
                <StickyNote className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Consultation Notes</h3>
              </div>
              <Textarea
                placeholder="Enter consultation notes, observations, clinical findings..."
                value={consultationNotes}
                onChange={(e) => setConsultationNotes(e.target.value)}
                className="rounded-xl min-h-[200px] text-sm"
              />
              <Button className="w-full rounded-xl" onClick={handleSaveNotes} disabled={savingNotes || !consultationNotes.trim()}>
                {savingNotes ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><StickyNote className="h-4 w-4 mr-2" /> Save Notes</>}
              </Button>
              {appointment.notes && (
                <div className="p-3 bg-secondary/50 rounded-xl mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Saved Notes</p>
                  <p className="text-sm">{appointment.notes}</p>
                </div>
              )}
            </TabsContent>

            {/* Prescribe Tab */}
            <TabsContent value="prescribe" className="p-4 space-y-3 mt-0">
              <div className="space-y-2">
                <Label className="text-sm">Diagnosis *</Label>
                <Input placeholder="Enter diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Medications</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addMedication} className="rounded-lg h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                {medications.map((med, idx) => (
                  <Card key={idx} className="p-3 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-muted-foreground">Med {idx + 1}</span>
                      {medications.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeMedication(idx)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <Input placeholder="Name" value={med.name} onChange={(e) => updateMedication(idx, 'name', e.target.value)} className="rounded-lg h-9 text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Dosage" value={med.dosage} onChange={(e) => updateMedication(idx, 'dosage', e.target.value)} className="rounded-lg h-9 text-sm" />
                      <Input placeholder="Frequency" value={med.frequency} onChange={(e) => updateMedication(idx, 'frequency', e.target.value)} className="rounded-lg h-9 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Duration" value={med.duration} onChange={(e) => updateMedication(idx, 'duration', e.target.value)} className="rounded-lg h-9 text-sm" />
                      <Input placeholder="Instructions" value={med.instructions} onChange={(e) => updateMedication(idx, 'instructions', e.target.value)} className="rounded-lg h-9 text-sm" />
                    </div>
                  </Card>
                ))}
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Instructions</Label>
                <Textarea placeholder="Additional instructions..." value={instructions} onChange={(e) => setInstructions(e.target.value)} className="rounded-xl min-h-16 text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Follow-up Date</Label>
                <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="rounded-xl" />
              </div>
              <Button className="w-full rounded-xl" onClick={handleSavePrescription} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><Pill className="h-4 w-4 mr-2" /> Save Prescription</>}
              </Button>
            </TabsContent>

            {/* History Tab - Real DB data */}
            <TabsContent value="history" className="p-4 space-y-3 mt-0">
              {loadingPast ? (
                <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
              ) : (
                <>
                  {/* Current visit prescriptions */}
                  {patientPrescriptions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">This Visit</h4>
                      {patientPrescriptions.map((rx) => {
                        const meds = Array.isArray(rx.medications) ? rx.medications as MedicationItem[] : [];
                        return (
                          <Card key={rx.id} className="p-3 rounded-xl space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-sm">{rx.diagnosis}</p>
                                <p className="text-xs text-muted-foreground">{format(new Date(rx.created_at), 'MMM d, yyyy')}</p>
                              </div>
                            </div>
                            {meds.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {meds.map((m, i) => <Badge key={i} variant="secondary" className="text-[10px]">{m.name} {m.dosage}</Badge>)}
                              </div>
                            )}
                            {rx.instructions && <p className="text-xs text-muted-foreground">{rx.instructions}</p>}
                            {rx.follow_up_date && <p className="text-xs text-primary font-medium">Follow-up: {format(new Date(rx.follow_up_date), 'MMM d, yyyy')}</p>}
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {/* Past visits */}
                  {pastVisits.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Past Visits</h4>
                      {pastVisits.map((visit) => {
                        const visitPrescriptions = visit.prescriptions || [];
                        return (
                          <Card key={visit.id} className="p-3 rounded-xl space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-sm">{format(new Date(visit.appointment_date), 'MMM d, yyyy')}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(visit.doctor as any)?.name} • {(visit.doctor as any)?.specialty}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-[10px]">{visit.status}</Badge>
                            </div>
                            {visit.chief_complaint && (
                              <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded-lg">{visit.chief_complaint}</p>
                            )}
                            {visit.notes && (
                              <div className="flex items-start gap-1.5">
                                <StickyNote className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                                <p className="text-xs">{visit.notes}</p>
                              </div>
                            )}
                            {visitPrescriptions.map((rx: any) => {
                              const meds = Array.isArray(rx.medications) ? rx.medications as MedicationItem[] : [];
                              return (
                                <div key={rx.id} className="pl-3 border-l-2 border-primary/20 space-y-1">
                                  <p className="text-xs font-medium">{rx.diagnosis}</p>
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
                    <div className="p-6 text-center">
                      <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No visit history found</p>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
