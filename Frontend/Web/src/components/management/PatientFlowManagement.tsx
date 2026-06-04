import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Video, User, Clock, CheckCircle, XCircle, UserCheck } from 'lucide-react';
import type { DoctorWithStats, AppointmentWithDetails } from '@/hooks/useManagementData';

interface PatientFlowManagementProps {
  doctors: DoctorWithStats[];
  appointments: AppointmentWithDetails[];
  onUpdateStatus: (id: string, status: string) => void;
  onReassign: (id: string, newDoctorId: string) => void;
}

export function PatientFlowManagement({
  doctors,
  appointments,
  onUpdateStatus,
  onReassign,
}: PatientFlowManagementProps) {
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);

  const specialties = [...new Set(doctors.map(d => d.specialty))];

  const filteredAppointments = appointments.filter(apt => {
    if (selectedDoctor && apt.doctor_id !== selectedDoctor) return false;
    if (selectedSpecialty) {
      const doc = doctors.find(d => d.id === apt.doctor_id);
      if (doc?.specialty !== selectedSpecialty) return false;
    }
    return true;
  });

  const stats = {
    total: filteredAppointments.length,
    physical: filteredAppointments.filter(a => a.appointment_type === 'physical').length,
    video: filteredAppointments.filter(a => a.appointment_type === 'video').length,
    arrived: filteredAppointments.filter(a => a.status === 'waiting').length,
    waiting: filteredAppointments.filter(a => ['confirmed', 'waiting'].includes(a.status)).length,
    inConsultation: filteredAppointments.filter(a => a.status === 'in_consultation').length,
    completed: filteredAppointments.filter(a => a.status === 'completed').length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-500';
      case 'waiting': return 'bg-yellow-500';
      case 'in_consultation': return 'bg-primary';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-gray-500';
      case 'no_show': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Patient Flow Management</h1>

      {/* Filters */}
      <Card className="p-4 rounded-2xl border-border">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-sm mb-2 block">Filter by Doctor</Label>
            <Select value={selectedDoctor || 'all'} onValueChange={(v) => setSelectedDoctor(v === 'all' ? null : v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="All Doctors" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border">
                <SelectItem value="all">All Doctors</SelectItem>
                {doctors.filter(d => d.is_active).map(doc => (
                  <SelectItem key={doc.id} value={doc.id}>{doc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label className="text-sm mb-2 block">Filter by Specialty</Label>
            <Select value={selectedSpecialty || 'all'} onValueChange={(v) => setSelectedSpecialty(v === 'all' ? null : v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="All Specialties" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border">
                <SelectItem value="all">All Specialties</SelectItem>
                {specialties.map(spec => (
                  <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 rounded-2xl border-border">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Total</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">{stats.total}</p>
        </Card>
        <Card className="p-4 rounded-2xl border-border">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">In-Person</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">{stats.physical}</p>
        </Card>
        <Card className="p-4 rounded-2xl border-border">
          <div className="flex items-center gap-2 mb-2">
            <Video className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Video</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">{stats.video}</p>
        </Card>
        <Card className="p-4 rounded-2xl border-border">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="h-4 w-4 text-chart-3" />
            <h3 className="text-sm font-medium text-muted-foreground">Arrived</h3>
          </div>
          <p className="text-3xl font-bold text-chart-3">{stats.arrived}</p>
        </Card>
        <Card className="p-4 rounded-2xl border-border">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-chart-4" />
            <h3 className="text-sm font-medium text-muted-foreground">Waiting</h3>
          </div>
          <p className="text-3xl font-bold text-chart-4">{stats.waiting}</p>
        </Card>
      </div>

      {/* Patient Queue */}
      <Card className="rounded-3xl shadow-sm border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">Live Patient Queue</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Token</th>
                <th className="px-4 py-3 text-left font-semibold">Patient</th>
                <th className="px-4 py-3 text-left font-semibold">Doctor</th>
                <th className="px-4 py-3 text-left font-semibold">Time</th>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Wait Time</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No appointments found
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((apt) => {
                  // Calculate wait time
                  let waitTime = '-';
                  if (apt.check_in_time && !apt.consultation_start_time) {
                    const waitMs = Date.now() - new Date(apt.check_in_time).getTime();
                    waitTime = `${Math.round(waitMs / 60000)} min`;
                  }

                  return (
                    <tr key={apt.id} className="hover:bg-accent/50">
                      <td className="px-4 py-3 font-medium">{apt.token}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{apt.patient?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{apt.patient?.patient_id}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={apt.doctor_id}
                          onValueChange={(newId) => onReassign(apt.id, newId)}
                        >
                          <SelectTrigger className="w-40 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background border-border">
                            {doctors.filter(d => d.is_active).map(doc => (
                              <SelectItem key={doc.id} value={doc.id}>
                                {doc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">{apt.appointment_time}</td>
                      <td className="px-4 py-3">
                        <Badge variant={apt.appointment_type === 'video' ? 'secondary' : 'outline'}>
                          {apt.appointment_type === 'video' ? (
                            <><Video className="h-3 w-3 mr-1" /> Video</>
                          ) : (
                            <><User className="h-3 w-3 mr-1" /> Physical</>
                          )}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getStatusColor(apt.status)}>
                          {apt.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{waitTime}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {apt.status === 'confirmed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl"
                              onClick={() => onUpdateStatus(apt.id, 'waiting')}
                            >
                              Mark Arrived
                            </Button>
                          )}
                          {apt.status === 'waiting' && (
                            <Button
                              size="sm"
                              className="rounded-xl"
                              onClick={() => onUpdateStatus(apt.id, 'in_consultation')}
                            >
                              Start Consult
                            </Button>
                          )}
                          {apt.status === 'in_consultation' && (
                            <Button
                              size="sm"
                              variant="default"
                              className="rounded-xl"
                              onClick={() => onUpdateStatus(apt.id, 'completed')}
                            >
                              Complete
                            </Button>
                          )}
                          {['confirmed', 'waiting'].includes(apt.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-xl text-destructive"
                              onClick={() => onUpdateStatus(apt.id, 'no_show')}
                            >
                              No Show
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
