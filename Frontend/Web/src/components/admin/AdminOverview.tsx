import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Calendar,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  UserCheck,
  Timer,
  BarChart3,
  Zap,
  QrCode,
  Brain,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { useAdminStats } from '@/hooks/useAdminData';
import { useMLAnalytics } from '@/hooks/useAnalytics';

interface AdminOverviewProps {
  selectedDate: Date;
}

export function AdminOverview({ selectedDate }: AdminOverviewProps) {
  const {
    appointmentStats,
    doctorStats,
    recentCheckIns,
    avgWaitTime,
    isLoading
  } = useAdminStats(selectedDate);

  // Fetch ML Analytics (rule-based analytics from the backend / Python API).
  // The hook returns { mlData, loading, error }; `mlData` is the
  // AnalyticsData payload (ensemble / forecast / risks) or null.
  const { mlData, loading: mlLoading, error: mlError } = useMLAnalytics();

  const displayDate = selectedDate || new Date();

  // Calculate derived stats
  const completionRate = appointmentStats.total > 0
    ? Math.round((appointmentStats.completed / appointmentStats.total) * 100)
    : 0;

  const noShowRate = appointmentStats.total > 0
    ? Math.round((appointmentStats.noShow / appointmentStats.total) * 100)
    : 0;

  const activeDoctors = doctorStats.filter(d => d.totalSeen > 0).length;
  const totalDoctors = doctorStats.length;
  const totalQuota = doctorStats.reduce((sum, d) => sum + d.totalQuota, 0);
  const totalSeen = doctorStats.reduce((sum, d) => sum + d.totalSeen, 0);
  const utilizationRate = totalQuota > 0 ? Math.round((totalSeen / totalQuota) * 100) : 0;

  // Group by specialty
  const specialtyStats = doctorStats.reduce((acc, doctor) => {
    const specialty = doctor.specialty || 'General';
    if (!acc[specialty]) {
      acc[specialty] = { doctors: 0, seen: 0, quota: 0 };
    }
    acc[specialty].doctors++;
    acc[specialty].seen += doctor.totalSeen;
    acc[specialty].quota += doctor.totalQuota;
    return acc;
  }, {} as Record<string, { doctors: number; seen: number; quota: number }>);

  const stats = [
    {
      label: 'Total Appointments',
      value: appointmentStats.total,
      change: `${appointmentStats.confirmed} confirmed`,
      icon: Calendar,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Waiting Queue',
      value: appointmentStats.arrived,
      change: `${appointmentStats.inConsultation} in consult`,
      icon: Clock,
      color: 'text-chart-4',
      bgColor: 'bg-chart-4/10',
    },
    {
      label: 'Completed Today',
      value: appointmentStats.completed,
      change: `${completionRate}% completion`,
      icon: CheckCircle2,
      color: 'text-chart-3',
      bgColor: 'bg-chart-3/10',
    },
    {
      label: 'No Shows',
      value: appointmentStats.noShow,
      change: `${noShowRate}% rate`,
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-1">
          Real-time data for {format(displayDate, "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-5 rounded-2xl border-border hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-2">{stat.change}</p>
                </div>
                <div className={`h-11 w-11 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Monitoring Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Queue Monitor */}
        <Card className="p-5 rounded-2xl border-border">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Queue Monitor</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Arrived</span>
              <Badge variant="outline" className="bg-chart-3/10 text-chart-3 border-chart-3/20">
                {appointmentStats.arrived}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">In Consult</span>
              <Badge variant="outline" className="bg-chart-5/10 text-chart-5 border-chart-5/20">
                {appointmentStats.inConsultation}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pending</span>
              <Badge variant="outline" className="bg-chart-4/10 text-chart-4 border-chart-4/20">
                {appointmentStats.confirmed}
              </Badge>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Avg Wait Time</span>
                <span className="font-semibold">~{avgWaitTime || 0} min</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Doctor Utilization */}
        <Card className="p-5 rounded-2xl border-border">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Doctor Utilization</h3>
          </div>
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">{utilizationRate}%</p>
              <p className="text-xs text-muted-foreground">Overall Capacity Used</p>
            </div>
            <Progress value={utilizationRate} className="h-2" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Active Doctors</span>
              <span className="font-semibold">{activeDoctors}/{totalDoctors}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Patients Seen</span>
              <span className="font-semibold">{totalSeen}/{totalQuota}</span>
            </div>
          </div>
        </Card>

        {/* Appointment Types */}
        <Card className="p-5 rounded-2xl border-border">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Appointment Types</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">In-Person</span>
              <Badge variant="outline">{appointmentStats.physical}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Video Consult</span>
              <Badge variant="outline" className="bg-chart-5/10 text-chart-5">
                {appointmentStats.video}
              </Badge>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Arrival Rate</span>
                <span className="font-semibold">
                  {appointmentStats.total > 0
                    ? Math.round(((appointmentStats.arrived + appointmentStats.inConsultation + appointmentStats.completed) / appointmentStats.total) * 100)
                    : 0}%
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* System Status */}
        <Card className="p-5 rounded-2xl border-border">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">System Status</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-chart-3/10 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-chart-3" />
                <span className="text-sm">All Systems</span>
              </div>
              <Badge className="bg-chart-3 text-white text-xs">Online</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Database</span>
              <span className="font-semibold text-chart-3">Connected</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Real-time</span>
              <span className="font-semibold text-chart-3">Active</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Recent Check-Ins */}
        <Card className="p-5 rounded-2xl border-border">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Recent Check-Ins</h3>
          </div>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {recentCheckIns.length > 0 ? (
                recentCheckIns.map((checkIn) => (
                  <div key={checkIn.id} className="p-3 bg-chart-3/5 border border-chart-3/20 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-chart-3/10 flex items-center justify-center">
                          <UserCheck className="h-4 w-4 text-chart-3" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{checkIn.patientName}</p>
                          <p className="text-xs text-muted-foreground">{checkIn.token}</p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={checkIn.status === 'in_consultation'
                          ? "bg-chart-5/10 text-chart-5 border-chart-5/20"
                          : "bg-chart-3/10 text-chart-3 border-chart-3/20"
                        }
                      >
                        {checkIn.status === 'in_consultation' ? 'In Consult' : 'Arrived'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Stethoscope className="h-3 w-3" />
                      <span>{checkIn.doctorName}</span>
                      <span className="ml-auto">{checkIn.appointmentTime}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <QrCode className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recent check-ins</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Active Doctors */}
        <Card className="p-5 rounded-2xl border-border lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Active Doctors</h3>
            <Badge variant="outline">{activeDoctors} active</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {doctorStats.slice(0, 6).map((doctor) => (
              <div
                key={doctor.id}
                className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Stethoscope className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{doctor.name}</p>
                  <p className="text-xs text-muted-foreground">{doctor.specialty}</p>
                  <Progress value={doctor.utilizationRate} className="h-1 mt-1" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{doctor.totalSeen}/{doctor.totalQuota}</p>
                  <p className="text-xs text-muted-foreground">{doctor.utilizationRate}%</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Specialty Breakdown */}
        <Card className="p-5 rounded-2xl border-border lg:col-span-3">
          <h3 className="font-semibold text-foreground mb-4">By Specialty</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(specialtyStats).slice(0, 8).map(([specialty, stats]) => (
              <div key={specialty} className="p-3 bg-secondary/50 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate">{specialty}</span>
                  <Badge variant="outline" className="text-xs">
                    {stats.doctors} docs
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{stats.seen} seen</span>
                  <span>{stats.quota} quota</span>
                </div>
                <Progress
                  value={stats.quota > 0 ? (stats.seen / stats.quota) * 100 : 0}
                  className="h-1 mt-2"
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ML Analytics Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">ML Analytics & Predictions</h2>
          {mlLoading && <Badge variant="outline" className="text-xs">Loading...</Badge>}
          {mlError && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              API Offline
            </Badge>
          )}
        </div>

        {mlError && (
          <Card className="p-4 rounded-2xl border-destructive/50 bg-destructive/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">ML API Not Available</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {mlError}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Start the Python backend: <code className="bg-secondary px-1 py-0.5 rounded">python main.py</code>
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Ensemble Prediction */}
          <Card className="p-5 rounded-2xl border-border">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Ensemble Model</h3>
            </div>
            {mlLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : mlData?.ensemble ? (
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-4xl font-bold text-primary">
                    {mlData.ensemble.no_show_rate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Predicted No-Show Rate</p>
                </div>
                <Progress value={Math.min(mlData.ensemble.no_show_rate, 100)} className="h-2" />
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">High-Risk Appointments</span>
                    <span className="font-semibold">{mlData.ensemble.high_risk_count}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Average Risk Score</span>
                    <span className="font-semibold">
                      {(mlData.ensemble.average_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No prediction data</p>
              </div>
            )}
          </Card>

          {/* Volume Forecast */}
          <Card className="p-5 rounded-2xl border-border">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Volume Forecast</h3>
            </div>
            {mlLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : mlData?.forecast && mlData.forecast.dates.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Forecast Window</span>
                  <Badge variant="outline">{mlData.forecast.dates.length} days</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Predicted Visits</span>
                  <Badge variant="default">
                    {mlData.forecast.predicted_volume.reduce((s, v) => s + v, 0)}
                  </Badge>
                </div>
                <div className="pt-2 border-t border-border space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Daily Forecast:</p>
                  {mlData.forecast.dates.slice(0, 7).map((d, i) => (
                    <div key={d} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {format(new Date(d), 'EEE, MMM d')}
                      </span>
                      <span className="font-semibold">
                        {mlData.forecast.predicted_volume[i] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No forecast data</p>
              </div>
            )}
          </Card>

          {/* High-Risk Appointments */}
          <Card className="p-5 rounded-2xl border-border">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h3 className="font-semibold text-foreground">High-Risk Alerts</h3>
            </div>
            {mlLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : mlData?.risks ? (
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-4xl font-bold text-destructive">
                    {mlData.risks.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Upcoming High-Risk</p>
                </div>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {mlData.risks.length > 0 ? (
                      mlData.risks.slice(0, 8).map((risk) => (
                        <div key={risk.appointment_id} className="p-2 bg-destructive/5 border border-destructive/20 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium truncate">
                              {risk.patient_name || 'Unknown'}
                            </span>
                            <Badge variant="destructive" className="text-xs">
                              {((risk.no_show_score || 0) * 100).toFixed(0)}%
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {risk.appointment_date} • {risk.appointment_time?.slice(0, 5)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No high-risk appointments
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No risk data</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
