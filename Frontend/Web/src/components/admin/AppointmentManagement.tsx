import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Calendar as CalendarIcon,
  Clock,
  Stethoscope,
  User,
  Eye,
  CheckCircle2,
  RefreshCw,
  UserX,
  Plus,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAdminAppointments } from '@/hooks/useAdminData';
import { useDoctors } from '@/hooks/useDoctors';
import { supabase } from '@/integrations/supabase/client';
import { NoShowRiskBadge } from '@/components/admin/NoShowRiskBadge';

interface AppointmentManagementProps {
  selectedDate: Date;
}

export function AppointmentManagement({ selectedDate }: AppointmentManagementProps) {
  const { appointments, isLoading, updateAppointmentStatus, reassignDoctor, rescheduleAppointment } = useAdminAppointments(selectedDate);
  const { doctors } = useDoctors();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [reassignDoctorId, setReassignDoctorId] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState<Date>();
  const [rescheduleTime, setRescheduleTime] = useState('');

  // Create appointment state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAppt, setNewAppt] = useState({
    patientSearch: '',
    patientId: '',
    patientName: '',
    doctorId: '',
    appointmentDate: format(selectedDate, 'yyyy-MM-dd'),
    appointmentTime: '',
    appointmentType: 'physical' as 'physical' | 'video',
    chiefComplaint: '',
  });
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [searchingPatient, setSearchingPatient] = useState(false);

  const timeSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];

  const filteredAppointments = appointments.filter((appt: any) => {
    const patient = appt.patient;
    const matchesSearch =
      patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      appt.token?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient?.patient_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || appt.status === statusFilter;
    const matchesDoctor = doctorFilter === 'all' || appt.doctor_id === doctorFilter;
    return matchesSearch && matchesStatus && matchesDoctor;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-chart-4/10 text-chart-4 border-chart-4/20';
      case 'waiting': return 'bg-chart-3/10 text-chart-3 border-chart-3/20';
      case 'in_consultation': return 'bg-primary/10 text-primary border-primary/20';
      case 'completed': return 'bg-chart-3/10 text-chart-3 border-chart-3/20';
      case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'no_show': return 'bg-muted text-muted-foreground border-muted';
      default: return 'bg-secondary text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'waiting': return 'Waiting';
      case 'in_consultation': return 'In Consult';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      case 'no_show': return 'No Show';
      default: return status;
    }
  };

  type AppointmentStatus = 'confirmed' | 'waiting' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show';

  const handleStatusChange = async (appointmentId: string, newStatus: AppointmentStatus) => {
    const { error } = await updateAppointmentStatus(appointmentId, newStatus);
    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success(`Status updated to ${getStatusLabel(newStatus)}`);
    }
  };

  const handleReassign = async () => {
    if (!selectedAppointment || !reassignDoctorId) return;

    const { error } = await reassignDoctor(selectedAppointment.id, reassignDoctorId);
    if (error) {
      toast.error('Failed to reassign doctor');
    } else {
      const newDoctor = doctors.find(d => d.id === reassignDoctorId);
      toast.success(`Reassigned to ${newDoctor?.name}`);
      setSelectedAppointment(null);
      setReassignDoctorId('');
    }
  };

  const handleReschedule = async () => {
    if (!selectedAppointment || !rescheduleDate || !rescheduleTime) return;

    const { error } = await rescheduleAppointment(
      selectedAppointment.id,
      format(rescheduleDate, 'yyyy-MM-dd'),
      rescheduleTime
    );
    if (error) {
      toast.error('Failed to reschedule');
    } else {
      toast.success('Appointment rescheduled');
      setSelectedAppointment(null);
      setRescheduleDate(undefined);
      setRescheduleTime('');
    }
  };

  // Search patients for appointment creation
  const handlePatientSearch = async (query: string) => {
    setNewAppt(prev => ({ ...prev, patientSearch: query }));
    if (query.length < 2) { setPatientResults([]); return; }
    setSearchingPatient(true);
    try {
      const { data } = await supabase
        .from('patients')
        .select('id, full_name, indus_id, phone')
        .or(`full_name.ilike.%${query}%,indus_id.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(5);
      setPatientResults(data || []);
    } catch { setPatientResults([]); }
    finally { setSearchingPatient(false); }
  };

  const handleCreateAppointment = async () => {
    if (!newAppt.patientId || !newAppt.doctorId || !newAppt.appointmentTime) {
      toast.error('Please select patient, doctor, and time');
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.from('appointments').insert({
        patient_id: newAppt.patientId,
        doctor_id: newAppt.doctorId,
        appointment_date: newAppt.appointmentDate,
        appointment_time: newAppt.appointmentTime,
        appointment_type: newAppt.appointmentType,
        chief_complaint: newAppt.chiefComplaint || null,
        token: '', // Generated by trigger
        status: 'confirmed',
      });
      if (error) throw error;
      toast.success('Appointment created successfully');
      setIsCreateOpen(false);
      setNewAppt({ patientSearch: '', patientId: '', patientName: '', doctorId: '', appointmentDate: format(selectedDate, 'yyyy-MM-dd'), appointmentTime: '', appointmentType: 'physical', chiefComplaint: '' });
      setPatientResults([]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create appointment');
    } finally {
      setCreating(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Token', 'Patient', 'Doctor', 'Time', 'Type', 'Status', 'Chief Complaint'];
    const rows = filteredAppointments.map((appt: any) => [
      appt.token,
      appt.patient?.name || '-',
      appt.doctor?.name || '-',
      appt.appointment_time,
      appt.appointment_type,
      appt.status,
      appt.chief_complaint || '-',
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `appointments_${format(selectedDate, 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Appointments exported');
  };

  // Stats
  const stats = {
    total: appointments.length,
    confirmed: appointments.filter((a: any) => a.status === 'confirmed').length,
    arrived: appointments.filter((a: any) => a.status === 'waiting').length,
    inConsult: appointments.filter((a: any) => a.status === 'in_consultation').length,
    completed: appointments.filter((a: any) => a.status === 'completed').length,
    cancelled: appointments.filter((a: any) => a.status === 'cancelled').length,
    noShow: appointments.filter((a: any) => a.status === 'no_show').length,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Appointment Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage appointments for {format(selectedDate, 'MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl gap-2" onClick={exportToCSV}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2">
                <Plus className="h-4 w-4" />
                New Appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Appointment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Patient Search */}
                <div className="space-y-2">
                  <Label>Patient *</Label>
                  {newAppt.patientName ? (
                    <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-xl">
                      <User className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{newAppt.patientName}</span>
                      <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => setNewAppt(prev => ({ ...prev, patientId: '', patientName: '', patientSearch: '' }))}>
                        Change
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Input
                        placeholder="Search by name, ID, or phone..."
                        value={newAppt.patientSearch}
                        onChange={(e) => handlePatientSearch(e.target.value)}
                        className="rounded-xl"
                      />
                      {patientResults.length > 0 && (
                        <div className="border rounded-xl overflow-hidden divide-y">
                          {patientResults.map(p => (
                            <button
                              key={p.id}
                              className="w-full p-2.5 text-left hover:bg-secondary/50 text-sm"
                              onClick={() => {
                                setNewAppt(prev => ({ ...prev, patientId: p.id, patientName: p.name, patientSearch: '' }));
                                setPatientResults([]);
                              }}
                            >
                              <span className="font-medium">{p.name}</span>
                              <span className="text-muted-foreground ml-2">{p.patient_id}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Doctor *</Label>
                  <Select value={newAppt.doctorId} onValueChange={(v) => setNewAppt(prev => ({ ...prev, doctorId: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select doctor" /></SelectTrigger>
                    <SelectContent>
                      {doctors.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name} — {d.specialty}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={newAppt.appointmentDate} onChange={(e) => setNewAppt(prev => ({ ...prev, appointmentDate: e.target.value }))} className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Time *</Label>
                    <Select value={newAppt.appointmentTime} onValueChange={(v) => setNewAppt(prev => ({ ...prev, appointmentTime: v }))}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Time" /></SelectTrigger>
                      <SelectContent>{timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newAppt.appointmentType} onValueChange={(v: 'physical' | 'video') => setNewAppt(prev => ({ ...prev, appointmentType: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="physical">Physical</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Chief Complaint</Label>
                  <Textarea
                    placeholder="Reason for visit..."
                    value={newAppt.chiefComplaint}
                    onChange={(e) => setNewAppt(prev => ({ ...prev, chiefComplaint: e.target.value }))}
                    className="rounded-xl"
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl">Cancel</Button>
                <Button onClick={handleCreateAppointment} disabled={creating} className="rounded-xl">
                  {creating ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="p-3 rounded-xl border-border">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-bold text-foreground">{stats.total}</p>
        </Card>
        <Card className="p-3 rounded-xl border-border">
          <p className="text-xs text-muted-foreground">Confirmed</p>
          <p className="text-xl font-bold text-chart-4">{stats.confirmed}</p>
        </Card>
        <Card className="p-3 rounded-xl border-border">
          <p className="text-xs text-muted-foreground">Waiting</p>
          <p className="text-xl font-bold text-chart-3">{stats.arrived}</p>
        </Card>
        <Card className="p-3 rounded-xl border-border">
          <p className="text-xs text-muted-foreground">In Consult</p>
          <p className="text-xl font-bold text-primary">{stats.inConsult}</p>
        </Card>
        <Card className="p-3 rounded-xl border-border">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-xl font-bold text-chart-3">{stats.completed}</p>
        </Card>
        <Card className="p-3 rounded-xl border-border">
          <p className="text-xs text-muted-foreground">Cancelled</p>
          <p className="text-xl font-bold text-muted-foreground">{stats.cancelled}</p>
        </Card>
        <Card className="p-3 rounded-xl border-border">
          <p className="text-xs text-muted-foreground">No Show</p>
          <p className="text-xl font-bold text-destructive">{stats.noShow}</p>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, token, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] rounded-xl">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="in_consultation">In Consult</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="no_show">No Show</SelectItem>
          </SelectContent>
        </Select>
        <Select value={doctorFilter} onValueChange={setDoctorFilter}>
          <SelectTrigger className="w-[180px] rounded-xl">
            <SelectValue placeholder="Filter by doctor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Doctors</SelectItem>
            {doctors.map((doctor) => (
              <SelectItem key={doctor.id} value={doctor.id}>{doctor.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Appointments List */}
      <Card className="rounded-2xl border-border overflow-hidden">
        <ScrollArea className="h-[500px]">
          <div className="divide-y divide-border">
            {filteredAppointments.map((appt: any) => {
              const patient = appt.patient;
              const doctor = appt.doctor;
              return (
                <div
                  key={appt.id}
                  className="p-4 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground">{patient?.name || 'Unknown'}</p>
                          <Badge variant="outline" className="text-xs">{appt.token}</Badge>
                          <Badge variant="outline" className={cn("text-xs", appt.appointment_type === 'video' ? 'bg-chart-5/10 text-chart-5' : '')}>
                            {appt.appointment_type === 'video' ? 'Video' : 'Physical'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Stethoscope className="h-3 w-3" />
                            {doctor?.name || 'Unassigned'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {appt.appointment_time}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={getStatusColor(appt.status)}>
                        {getStatusLabel(appt.status)}
                      </Badge>

                      {/* No-Show Risk Badge */}
                      {appt.no_show_score !== undefined && appt.no_show_score !== null && (
                        <NoShowRiskBadge
                          score={Number(appt.no_show_score)}
                          factors={[]}
                          specialty={doctor?.specialty || 'General Medicine'}
                          appointmentType={appt.appointment_type || 'physical'}
                          appointmentTime={appt.appointment_time || '09:00'}
                        />
                      )}

                      {/* Quick Actions */}
                      <div className="flex gap-1">
                        {appt.status === 'confirmed' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Mark No Show"
                            onClick={() => handleStatusChange(appt.id, 'no_show')}>
                            <UserX className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                        {appt.status === 'confirmed' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Mark Arrived"
                            onClick={() => handleStatusChange(appt.id, 'waiting')}>
                            <CheckCircle2 className="h-4 w-4 text-chart-3" />
                          </Button>
                        )}
                        {appt.status !== 'completed' && appt.status !== 'cancelled' && appt.status !== 'no_show' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Cancel"
                            onClick={() => handleStatusChange(appt.id, 'cancelled')}>
                            <UserX className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => setSelectedAppointment(appt)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Appointment Details</DialogTitle>
                            </DialogHeader>
                            {selectedAppointment && (
                              <div className="space-y-4 py-4">
                                <div className="flex items-center gap-4">
                                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <User className="h-6 w-6 text-primary" />
                                  </div>
                                  <div>
                                    <p className="font-semibold">{selectedAppointment.patient?.name}</p>
                                    <p className="text-sm text-muted-foreground">{selectedAppointment.token} • {selectedAppointment.patient?.patient_id}</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/50 rounded-xl">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Doctor</p>
                                    <p className="font-medium">{selectedAppointment.doctor?.name}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Time</p>
                                    <p className="font-medium">{selectedAppointment.appointment_time}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Type</p>
                                    <p className="font-medium capitalize">{selectedAppointment.appointment_type}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Status</p>
                                    <Badge variant="outline" className={getStatusColor(selectedAppointment.status)}>
                                      {getStatusLabel(selectedAppointment.status)}
                                    </Badge>
                                  </div>
                                </div>

                                {selectedAppointment.chief_complaint && (
                                  <div>
                                    <p className="text-sm font-medium mb-1">Chief Complaint</p>
                                    <p className="text-sm text-muted-foreground p-3 bg-secondary rounded-xl">
                                      {selectedAppointment.chief_complaint}
                                    </p>
                                  </div>
                                )}

                                {/* Status Change */}
                                <div className="space-y-2">
                                  <Label>Change Status</Label>
                                  <div className="flex flex-wrap gap-2">
                                    {(['confirmed', 'waiting', 'in_consultation', 'completed', 'cancelled', 'no_show'] as AppointmentStatus[])
                                      .filter(s => s !== selectedAppointment.status)
                                      .map(s => (
                                        <Button key={s} variant="outline" size="sm" className="rounded-xl text-xs"
                                          onClick={() => { handleStatusChange(selectedAppointment.id, s); setSelectedAppointment({ ...selectedAppointment, status: s }); }}>
                                          {getStatusLabel(s)}
                                        </Button>
                                      ))
                                    }
                                  </div>
                                </div>

                                {/* Reassign Doctor */}
                                <div className="space-y-2">
                                  <Label>Reassign Doctor</Label>
                                  <div className="flex gap-2">
                                    <Select value={reassignDoctorId} onValueChange={setReassignDoctorId}>
                                      <SelectTrigger className="flex-1 rounded-xl">
                                        <SelectValue placeholder="Select doctor" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {doctors.map(d => (
                                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button variant="outline" className="rounded-xl" onClick={handleReassign} disabled={!reassignDoctorId}>
                                      <RefreshCw className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>

                                {/* Reschedule */}
                                <div className="space-y-2">
                                  <Label>Reschedule</Label>
                                  <div className="flex gap-2">
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="outline" className="flex-1 rounded-xl justify-start">
                                          <CalendarIcon className="h-4 w-4 mr-2" />
                                          {rescheduleDate ? format(rescheduleDate, 'PP') : 'Pick date'}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={rescheduleDate} onSelect={setRescheduleDate}
                                          disabled={(date) => date < new Date()} className="pointer-events-auto" />
                                      </PopoverContent>
                                    </Popover>
                                    <Select value={rescheduleTime} onValueChange={setRescheduleTime}>
                                      <SelectTrigger className="w-[100px] rounded-xl"><SelectValue placeholder="Time" /></SelectTrigger>
                                      <SelectContent>{timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                    </Select>
                                  </div>
                                  <Button className="w-full rounded-xl" onClick={handleReschedule} disabled={!rescheduleDate || !rescheduleTime}>
                                    Reschedule Appointment
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </Card>

      {filteredAppointments.length === 0 && (
        <div className="text-center py-12">
          <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No appointments found</p>
        </div>
      )}
    </div>
  );
}
