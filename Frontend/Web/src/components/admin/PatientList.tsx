import { useState, useMemo, useCallback, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  User,
  Phone,
  Calendar as CalendarIcon,
  Clock,
  FileText,
  Eye,
  Stethoscope,
  Download,
} from 'lucide-react';
import { useAdminPatients } from '@/hooks/useAdminData';
import { useDoctors } from '@/hooks/useDoctors';

interface PatientListProps {
  selectedDate: Date;
}

export function PatientList({ selectedDate }: PatientListProps) {
  const { patients, isLoading } = useAdminPatients(selectedDate);
  const { doctors } = useDoctors();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');

  const filteredPatients = patients.filter((patient: any) => {
    const matchesSearch =
      patient.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.appointment?.token?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.patient_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || patient.appointment?.status === statusFilter;
    const matchesDoctor = doctorFilter === 'all' || patient.appointment?.doctorId === doctorFilter;

    return matchesSearch && matchesStatus && matchesDoctor;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-chart-4/10 text-chart-4';
      case 'waiting': return 'bg-chart-3/10 text-chart-3';
      case 'in_consultation': return 'bg-primary/10 text-primary';
      case 'completed': return 'bg-chart-3/10 text-chart-3';
      case 'cancelled': return 'bg-destructive/10 text-destructive';
      case 'no_show': return 'bg-muted text-muted-foreground';
      default: return 'bg-secondary text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'waiting': return 'Waiting';
      case 'in_consultation': return 'In Progress';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      case 'no_show': return 'No Show';
      default: return status;
    }
  };

  const exportToCSV = useCallback(() => {
    const headers = ['Name', 'Token', 'Patient ID', 'Doctor', 'Status', 'Appointment Time', 'Phone', 'Age', 'Gender', 'Chief Complaint'];
    const rows = filteredPatients.map((patient: any) => [
      patient.name,
      patient.appointment?.token || '-',
      patient.patient_id || '-',
      patient.appointment?.doctorName || 'Unassigned',
      patient.appointment?.status || '-',
      patient.appointment?.appointmentTime || '-',
      patient.phone || '-',
      patient.age || '-',
      patient.gender || '-',
      patient.appointment?.chiefComplaint || '-',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `patients_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredPatients]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Patient Records</h1>
          <p className="text-muted-foreground mt-1">View and manage today's patient appointments</p>
        </div>
        <Button variant="outline" className="rounded-xl gap-2" onClick={exportToCSV}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
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
              <SelectItem value="in_consultation">In Progress</SelectItem>
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
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="p-4 rounded-xl border-border">
          <p className="text-sm text-muted-foreground">Total Today</p>
          <p className="text-2xl font-bold text-foreground">{patients.length}</p>
        </Card>
        <Card className="p-4 rounded-xl border-border">
          <p className="text-sm text-muted-foreground">Waiting</p>
          <p className="text-2xl font-bold text-chart-3">
            {patients.filter((p: any) => p.appointment?.status === 'waiting').length}
          </p>
        </Card>
        <Card className="p-4 rounded-xl border-border">
          <p className="text-sm text-muted-foreground">In Progress</p>
          <p className="text-2xl font-bold text-primary">
            {patients.filter((p: any) => p.appointment?.status === 'in_consultation').length}
          </p>
        </Card>
        <Card className="p-4 rounded-xl border-border">
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold text-chart-3">
            {patients.filter((p: any) => p.appointment?.status === 'completed').length}
          </p>
        </Card>
        <Card className="p-4 rounded-xl border-border">
          <p className="text-sm text-muted-foreground">No Show</p>
          <p className="text-2xl font-bold text-destructive">
            {patients.filter((p: any) => p.appointment?.status === 'no_show').length}
          </p>
        </Card>
      </div>

      {/* Patient List */}
      <Card className="rounded-2xl border-border overflow-hidden">
        <ScrollArea className="h-[500px]">
          <div className="divide-y divide-border">
            {filteredPatients.map((patient: any) => (
              <div
                key={patient.appointment?.id || patient.id}
                className="p-4 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{patient.name}</p>
                        <Badge variant="outline" className="text-xs">{patient.appointment?.token}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Stethoscope className="h-3 w-3" />
                          {patient.appointment?.doctorName || 'Unassigned'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {patient.appointment?.appointmentTime}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={getStatusColor(patient.appointment?.status)}>
                      {getStatusLabel(patient.appointment?.status)}
                    </Badge>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setSelectedPatient(patient)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Patient Details</DialogTitle>
                        </DialogHeader>
                        {selectedPatient && (
                          <div className="space-y-4 py-4">
                            <div className="flex items-center gap-4">
                              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <User className="h-8 w-8 text-primary" />
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold">{selectedPatient.name}</h3>
                                <p className="text-muted-foreground">{selectedPatient.patient_id}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/50 rounded-xl">
                              <div>
                                <p className="text-xs text-muted-foreground">Token</p>
                                <p className="font-medium">{selectedPatient.appointment?.token}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Status</p>
                                <Badge className={getStatusColor(selectedPatient.appointment?.status)}>
                                  {getStatusLabel(selectedPatient.appointment?.status)}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Age / Gender</p>
                                <p className="font-medium">
                                  {selectedPatient.age || '-'} / {selectedPatient.gender || '-'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Blood Group</p>
                                <p className="font-medium">{selectedPatient.blood_group || '-'}</p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <p className="text-sm font-medium">Contact Information</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="h-4 w-4" />
                                <span>{selectedPatient.phone || 'Not provided'}</span>
                              </div>
                            </div>

                            {selectedPatient.appointment?.chiefComplaint && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium">Chief Complaint</p>
                                <p className="text-sm text-muted-foreground p-3 bg-secondary rounded-xl">
                                  {selectedPatient.appointment.chiefComplaint}
                                </p>
                              </div>
                            )}

                            <div className="flex gap-2 pt-2">
                              <Button variant="outline" className="flex-1 rounded-xl gap-2">
                                <FileText className="h-4 w-4" />
                                View History
                              </Button>
                              <Button className="flex-1 rounded-xl gap-2">
                                <CalendarIcon className="h-4 w-4" />
                                Reschedule
                              </Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {filteredPatients.length === 0 && (
        <div className="text-center py-12">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No patients found</p>
        </div>
      )}
    </div>
  );
}
