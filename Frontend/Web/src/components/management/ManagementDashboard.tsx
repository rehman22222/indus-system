import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, Activity, Clock, CheckCircle, XCircle } from 'lucide-react';
import type { ManagementStats, DoctorWithStats, AppointmentWithDetails } from '@/hooks/useManagementData';

interface ManagementDashboardProps {
  stats: ManagementStats;
  doctors: DoctorWithStats[];
  appointments: AppointmentWithDetails[];
  isLoading: boolean;
}

export function ManagementDashboard({ stats, doctors, appointments, isLoading }: ManagementDashboardProps) {
  const activeDoctors = doctors.filter(d => d.is_active);
  const currentPatients = appointments.filter(a => 
    ['waiting', 'in_consultation'].includes(a.status)
  ).slice(0, 6);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Live OPD Overview</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-6 rounded-3xl animate-pulse">
              <div className="h-20 bg-muted rounded-xl"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Live OPD Overview</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 rounded-3xl shadow-sm border-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground">Total Patients</p>
              <h3 className="text-3xl font-bold text-foreground mt-2">{stats.totalPatients}</h3>
              <p className="text-xs text-muted-foreground mt-1">Today</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-3xl shadow-sm border-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground">No-Show Rate</p>
              <h3 className="text-3xl font-bold text-foreground mt-2">{stats.noShowRate}%</h3>
              <p className="text-xs text-muted-foreground mt-1">Today</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-chart-4/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-chart-4" />
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-3xl shadow-sm border-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground">Avg Wait Time</p>
              <h3 className="text-3xl font-bold text-foreground mt-2">{stats.avgWaitTime} min</h3>
              <p className="text-xs text-chart-3 mt-1">Real-time</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-chart-3/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-chart-3" />
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-3xl shadow-sm border-border">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <h3 className="text-3xl font-bold text-foreground mt-2">{stats.completedCount}</h3>
              <p className="text-xs text-chart-3 mt-1">{stats.utilizationRate}% utilization</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-chart-3/10 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-chart-3" />
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 rounded-2xl border-border">
          <p className="text-sm text-muted-foreground">In-Person</p>
          <p className="text-2xl font-bold text-foreground">{stats.physicalCount}</p>
        </Card>
        <Card className="p-4 rounded-2xl border-border">
          <p className="text-sm text-muted-foreground">Video</p>
          <p className="text-2xl font-bold text-foreground">{stats.videoCount}</p>
        </Card>
        <Card className="p-4 rounded-2xl border-border">
          <p className="text-sm text-muted-foreground">Waiting</p>
          <p className="text-2xl font-bold text-chart-4">{stats.waitingCount}</p>
        </Card>
        <Card className="p-4 rounded-2xl border-border">
          <p className="text-sm text-muted-foreground">In Consultation</p>
          <p className="text-2xl font-bold text-primary">{stats.inConsultationCount}</p>
        </Card>
        <Card className="p-4 rounded-2xl border-border">
          <p className="text-sm text-muted-foreground">Cancelled</p>
          <p className="text-2xl font-bold text-muted-foreground">{stats.cancelledCount}</p>
        </Card>
      </div>

      {/* Doctor Status and Current Patients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 rounded-3xl shadow-sm border-border">
          <h3 className="text-lg font-semibold mb-4">Doctor Status</h3>
          <div className="space-y-4">
            {activeDoctors.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No active doctors</p>
            ) : (
              activeDoctors.slice(0, 5).map((doctor) => {
                const totalQuota = doctor.daily_physical_quota + doctor.daily_video_quota;
                const utilization = totalQuota > 0 ? (doctor.seen / totalQuota) * 100 : 0;
                return (
                  <div key={doctor.id} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{doctor.name}</p>
                      <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {doctor.seen}/{totalQuota}
                      </p>
                      <div className="w-24 h-2 bg-secondary rounded-full mt-1">
                        <div
                          className={`h-full rounded-full ${utilization > 90 ? 'bg-destructive' : 'bg-primary'}`}
                          style={{ width: `${Math.min(utilization, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="p-6 rounded-3xl shadow-sm border-border">
          <h3 className="text-lg font-semibold mb-4">Current Patients</h3>
          <div className="space-y-4">
            {currentPatients.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No patients currently</p>
            ) : (
              currentPatients.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between p-4 bg-secondary rounded-2xl"
                >
                  <div>
                    <p className="font-medium text-foreground">{appointment.patient?.name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">
                      Token: {appointment.token}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={appointment.status === 'in_consultation' ? 'default' : 'secondary'}
                    >
                      {appointment.status === 'in_consultation' ? 'In Progress' : 'Waiting'}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {appointment.doctor?.name}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
