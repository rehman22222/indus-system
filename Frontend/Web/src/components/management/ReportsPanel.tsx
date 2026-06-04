import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Users, Activity, Building } from 'lucide-react';
import { toast } from 'sonner';
import type { ManagementStats, DoctorWithStats, AppointmentWithDetails } from '@/hooks/useManagementData';

interface ReportsPanelProps {
  stats: ManagementStats;
  doctors: DoctorWithStats[];
  appointments: AppointmentWithDetails[];
  date: string;
}

export function ReportsPanel({ stats, doctors, appointments, date }: ReportsPanelProps) {
  const generateCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const value = row[h];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${date}.csv`;
    link.click();
    toast.success(`${filename} exported successfully`);
  };

  const downloadDailyReport = () => {
    const reportData = [{
      date,
      total_patients: stats.totalPatients,
      completed: stats.completedCount,
      in_person: stats.physicalCount,
      video: stats.videoCount,
      cancelled: stats.cancelledCount,
      no_show: stats.noShowCount,
      no_show_rate: `${stats.noShowRate}%`,
      avg_wait_time: `${stats.avgWaitTime} min`,
      utilization: `${stats.utilizationRate}%`,
    }];
    generateCSV(reportData, 'daily_opd_report');
  };

  const downloadDoctorReport = () => {
    const reportData = doctors.map(d => ({
      name: d.name,
      specialty: d.specialty,
      department: d.department?.name || '-',
      physical_quota: d.daily_physical_quota,
      video_quota: d.daily_video_quota,
      patients_seen: d.seen,
      physical_appointments: d.physicalCount,
      video_appointments: d.videoCount,
      remaining_slots: d.remaining,
      avg_wait_time: `${d.avgWaitTime} min`,
      utilization: `${Math.round((d.seen / (d.daily_physical_quota + d.daily_video_quota)) * 100)}%`,
    }));
    generateCSV(reportData, 'doctor_performance');
  };

  const downloadPatientFlowReport = () => {
    const reportData = appointments.map(a => ({
      token: a.token,
      patient_name: a.patient?.name || 'Unknown',
      patient_id: a.patient?.patient_id || '-',
      doctor: a.doctor?.name || '-',
      appointment_time: a.appointment_time,
      type: a.appointment_type,
      status: a.status,
      check_in_time: a.check_in_time || '-',
      consultation_start: a.consultation_start_time || '-',
      consultation_end: a.consultation_end_time || '-',
    }));
    generateCSV(reportData, 'patient_flow');
  };

  const downloadDepartmentReport = () => {
    const departments = [...new Set(doctors.map(d => d.department?.name).filter(Boolean))];
    const reportData = departments.map(dept => {
      const deptDoctors = doctors.filter(d => d.department?.name === dept);
      const deptAppointments = appointments.filter(a => 
        deptDoctors.some(d => d.id === a.doctor_id)
      );
      return {
        department: dept,
        doctors_count: deptDoctors.length,
        total_quota: deptDoctors.reduce((s, d) => s + d.daily_physical_quota + d.daily_video_quota, 0),
        patients_seen: deptDoctors.reduce((s, d) => s + d.seen, 0),
        appointments: deptAppointments.length,
        completed: deptAppointments.filter(a => a.status === 'completed').length,
        in_person: deptAppointments.filter(a => a.appointment_type === 'physical').length,
        video: deptAppointments.filter(a => a.appointment_type === 'video').length,
      };
    });
    generateCSV(reportData, 'department_report');
  };

  const reports = [
    {
      title: 'Daily OPD Report',
      description: "Complete overview of today's OPD operations including patient flow, doctor utilization, and wait times.",
      icon: FileText,
      onDownload: downloadDailyReport,
    },
    {
      title: 'Doctor Performance Report',
      description: 'Detailed analysis of each doctor\'s efficiency, patient count, and quota utilization.',
      icon: Users,
      onDownload: downloadDoctorReport,
    },
    {
      title: 'Patient Flow Analytics',
      description: 'Comprehensive analysis of patient movement, waiting patterns, and appointment statuses.',
      icon: Activity,
      onDownload: downloadPatientFlowReport,
    },
    {
      title: 'Department Summary',
      description: 'Compare performance metrics across departments including patient volume and efficiency.',
      icon: Building,
      onDownload: downloadDepartmentReport,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.title} className="p-6 rounded-3xl shadow-sm border-border">
              <div className="flex items-start gap-4 mb-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{report.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {report.description}
                  </p>
                </div>
              </div>
              <Button onClick={report.onDownload} className="w-full rounded-xl gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Quick Stats Summary */}
      <Card className="p-6 rounded-3xl shadow-sm border-border">
        <h3 className="font-semibold text-lg mb-4">Today's Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-secondary rounded-xl">
            <p className="text-sm text-muted-foreground">Total Appointments</p>
            <p className="text-2xl font-bold">{stats.totalPatients}</p>
          </div>
          <div className="p-4 bg-secondary rounded-xl">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-chart-3">{stats.completedCount}</p>
          </div>
          <div className="p-4 bg-secondary rounded-xl">
            <p className="text-sm text-muted-foreground">Active Doctors</p>
            <p className="text-2xl font-bold">{doctors.filter(d => d.is_active).length}</p>
          </div>
          <div className="p-4 bg-secondary rounded-xl">
            <p className="text-sm text-muted-foreground">Utilization</p>
            <p className="text-2xl font-bold">{stats.utilizationRate}%</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
