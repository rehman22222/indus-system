import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DoctorWithStats, ManagementStats } from '@/hooks/useManagementData';

interface PerformanceMetricsProps {
  stats: ManagementStats;
  doctors: DoctorWithStats[];
}

export function PerformanceMetrics({ stats, doctors }: PerformanceMetricsProps) {
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);

  const specialties = [...new Set(doctors.map(d => d.specialty))];

  const filteredDoctors = doctors.filter(d => {
    if (!d.is_active) return false;
    if (selectedDoctor && d.id !== selectedDoctor) return false;
    if (selectedSpecialty && d.specialty !== selectedSpecialty) return false;
    return true;
  });

  // Calculate totals for filtered doctors
  const totalQuota = filteredDoctors.reduce((sum, d) => 
    sum + d.daily_physical_quota + d.daily_video_quota, 0);
  const totalSeen = filteredDoctors.reduce((sum, d) => sum + d.seen, 0);
  const totalPhysical = filteredDoctors.reduce((sum, d) => sum + d.physicalCount, 0);
  const totalVideo = filteredDoctors.reduce((sum, d) => sum + d.videoCount, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Performance Metrics</h1>

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

      {/* Doctor Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDoctors.map((doctor) => {
          const totalQuota = doctor.daily_physical_quota + doctor.daily_video_quota;
          const completionRate = totalQuota > 0 ? Math.round((doctor.seen / totalQuota) * 100) : 0;

          return (
            <Card key={doctor.id} className="p-6 rounded-3xl shadow-sm border-border">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-foreground">{doctor.name}</h3>
                <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                {doctor.department && (
                  <Badge 
                    className="mt-2" 
                    style={{ backgroundColor: doctor.department.color, color: 'white' }}
                  >
                    {doctor.department.name}
                  </Badge>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Quota Utilization</span>
                    <span className="font-semibold text-foreground">{completionRate}%</span>
                  </div>
                  <div className="w-full h-3 bg-secondary rounded-full">
                    <div
                      className={`h-full rounded-full ${completionRate > 90 ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${Math.min(completionRate, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {doctor.seen} of {totalQuota} patients seen
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-secondary rounded-xl">
                    <p className="text-xs text-muted-foreground">In-Person</p>
                    <p className="text-xl font-bold text-foreground">{doctor.physicalCount}</p>
                  </div>
                  <div className="p-3 bg-secondary rounded-xl">
                    <p className="text-xs text-muted-foreground">Video</p>
                    <p className="text-xl font-bold text-foreground">{doctor.videoCount}</p>
                  </div>
                </div>

                <div className="p-3 bg-accent rounded-xl">
                  <p className="text-xs text-muted-foreground">Avg Wait Time</p>
                  <p className="text-2xl font-bold text-foreground">{doctor.avgWaitTime} min</p>
                </div>

                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">Weekly Schedule</p>
                  {doctor.schedule && Object.entries(doctor.schedule).map(([day, times]) => (
                    <div key={day} className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground capitalize">{day}</span>
                      <span className="font-medium text-foreground">
                        {(times as any).start} - {(times as any).end}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* System-Wide Performance */}
      {!selectedDoctor && (
        <Card className="p-6 rounded-3xl shadow-sm border-border">
          <h2 className="text-xl font-semibold mb-6">System-Wide Performance Today</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Total Capacity</p>
              <p className="text-3xl font-bold text-foreground">{totalQuota}</p>
              <p className="text-xs text-muted-foreground mt-1">slots available</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Patients Seen</p>
              <p className="text-3xl font-bold text-foreground">{totalSeen}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {totalQuota > 0 ? Math.round((totalSeen / totalQuota) * 100) : 0}% utilization
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Video Consults</p>
              <p className="text-3xl font-bold text-foreground">{totalVideo}</p>
              <p className="text-xs text-muted-foreground mt-1">online appointments</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">No-Show Rate</p>
              <p className="text-3xl font-bold text-foreground">{stats.noShowRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.noShowRate < 10 ? 'below' : 'above'} target of 10%
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
