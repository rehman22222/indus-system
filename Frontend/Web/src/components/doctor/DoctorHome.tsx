import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  MapPin, Video, CheckCircle2, Clock, Eye, Users, Loader2,
  PlayCircle, Pause, SkipForward
} from 'lucide-react';
import type { Appointment } from '@/hooks/useAppointments';
import type { DoctorWithName as Doctor } from '@/hooks/useDoctors';

interface DoctorHomeProps {
  doctor: Doctor;
  appointments: Appointment[];
  isLoading: boolean;
  filterDate: string;
  onFilterDateChange: (date: string) => void;
  onViewPatient: (apt: Appointment) => void;
  onStartConsultation: (apt: Appointment) => void;
  onCompleteConsultation: (apt: Appointment) => void;
  onJoinVideo: (apt: Appointment) => void;
}

export function DoctorHome({
  doctor, appointments, isLoading, filterDate,
  onFilterDateChange, onViewPatient, onStartConsultation, onCompleteConsultation, onJoinVideo
}: DoctorHomeProps) {
  const physicalCount = appointments.filter(p => p.appointment_type === 'physical').length;
  const videoCount = appointments.filter(p => p.appointment_type === 'video').length;
  const completedToday = appointments.filter(p => p.status === 'completed').length;
  const pendingToday = appointments.filter(p => !['completed', 'cancelled', 'no_show'].includes(p.status)).length;
  const inConsultation = appointments.find(p => p.status === 'in_consultation');

  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
      confirmed: { variant: 'outline', label: 'Waiting' },
      waiting: { variant: 'secondary', label: 'Arrived' },
      in_consultation: { variant: 'default', label: 'In Progress' },
      completed: { variant: 'default', label: 'Done' },
      cancelled: { variant: 'destructive', label: 'Cancelled' },
      no_show: { variant: 'destructive', label: 'No Show' },
    };
    const s = map[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  // Sort: in_consultation first, then arrived, then confirmed, then rest
  const sortedAppointments = [...appointments].sort((a, b) => {
    const order: Record<string, number> = { in_consultation: 0, waiting: 1, confirmed: 2, completed: 3, cancelled: 4, no_show: 5 };
    return (order[a.status] ?? 6) - (order[b.status] ?? 6);
  });

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Welcome */}
      <div className="brand-panel relative overflow-hidden rounded-3xl p-5 text-white shadow-[0_14px_32px_rgba(18,38,67,0.18)] md:p-7">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/60">Doctor dashboard</p>
        <h2 className="mt-1 text-xl font-extrabold text-white md:text-3xl">
          Good {getGreeting()}, Dr. {doctor.name.split(' ').slice(-1)[0]}
        </h2>
        <p className="text-sm text-white/70 mt-1">
          {completedToday} completed • {pendingToday} remaining
        </p>
      </div>

      {/* Current Consultation Banner */}
      {inConsultation && (
        <Card className="p-4 rounded-xl border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center animate-pulse">
                <PlayCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">In Consultation</p>
                <p className="text-xs text-muted-foreground">{inConsultation.patient?.name} • {inConsultation.token}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="rounded-lg" onClick={() => onCompleteConsultation(inConsultation)}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Complete
            </Button>
          </div>
        </Card>
      )}

      {/* Date Filter */}
      <div className="flex items-center gap-3">
        <Label className="shrink-0 text-sm">Date:</Label>
        <Input type="date" value={filterDate} onChange={(e) => onFilterDateChange(e.target.value)}
          className="rounded-xl max-w-[180px] h-10" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: MapPin, label: 'Physical', value: physicalCount, color: 'text-primary', bg: 'bg-primary/10' },
          { icon: Video, label: 'Video', value: videoCount, color: 'text-chart-2', bg: 'bg-chart-2/10' },
          { icon: CheckCircle2, label: 'Completed', value: completedToday, color: 'text-chart-3', bg: 'bg-chart-3/10' },
          { icon: Clock, label: 'Pending', value: pendingToday, color: 'text-chart-4', bg: 'bg-chart-4/10' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label} className="p-3 md:p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 md:h-12 md:w-12 rounded-xl flex items-center justify-center", bg)}>
                <Icon className={cn("h-5 w-5 md:h-6 md:w-6", color)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl md:text-2xl font-bold">{value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Patient Queue */}
      <Card className="rounded-xl overflow-hidden">
        <div className="p-3 md:p-4 border-b bg-secondary/30">
          <h3 className="font-medium text-sm md:text-base">Patient Queue</h3>
        </div>
        <div className="divide-y max-h-[50vh] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
          ) : sortedAppointments.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No patients scheduled</p>
            </div>
          ) : (
            sortedAppointments.map((apt) => (
              <div key={apt.id} className={cn(
                "p-3 md:p-4 flex items-center justify-between gap-2",
                apt.status === 'in_consultation' && "bg-primary/5"
              )} data-patient-name={apt.patient?.name || 'Unknown'}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={cn(
                    "h-9 w-9 md:h-10 md:w-10 rounded-xl flex items-center justify-center shrink-0",
                    apt.appointment_type === 'video' ? "bg-chart-2/10" : "bg-primary/10"
                  )}>
                    {apt.appointment_type === 'video'
                      ? <Video className="h-4 w-4 md:h-5 md:w-5 text-chart-2" />
                      : <MapPin className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{apt.patient?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{apt.token} • {apt.appointment_time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 md:gap-2 shrink-0">
                  {getStatusBadge(apt.status)}
                  {apt.status === 'waiting' && (
                    <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => onStartConsultation(apt)}
                      title="Start Consultation">
                      <PlayCircle className="h-4 w-4 text-chart-3" />
                    </Button>
                  )}
                  {apt.appointment_type === 'video' && ['waiting', 'in_consultation'].includes(apt.status) && (
                    <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => onJoinVideo(apt)}
                      title="Join Video Call">
                      <Video className="h-4 w-4 text-chart-2" />
                    </Button>
                  )}
                  {apt.status === 'in_consultation' && (
                    <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => onCompleteConsultation(apt)}
                      title="Complete">
                      <CheckCircle2 className="h-4 w-4 text-chart-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-lg h-8 w-8"
                    onClick={() => onViewPatient(apt)}
                    aria-label="View patient details"
                    title="View patient details"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
