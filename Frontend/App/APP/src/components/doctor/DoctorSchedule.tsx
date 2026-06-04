import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, MapPin, Video } from 'lucide-react';
import type { Doctor } from '@/hooks/useDoctors';
import type { Appointment } from '@/hooks/useAppointments';

interface DoctorScheduleProps {
  doctor: Doctor;
  appointments?: Appointment[];
}

export function DoctorSchedule({ doctor, appointments = [] }: DoctorScheduleProps) {
  const schedule = doctor.schedule as Record<string, { start: string; end: string }> | null;

  // Calculate quota usage
  const physicalToday = appointments.filter(a => a.appointment_type === 'physical' && !['cancelled', 'no_show'].includes(a.status)).length;
  const videoToday = appointments.filter(a => a.appointment_type === 'video' && !['cancelled', 'no_show'].includes(a.status)).length;
  const physicalQuota = doctor.daily_physical_quota || 0;
  const videoQuota = doctor.daily_video_quota || 0;
  const physicalRemaining = Math.max(0, physicalQuota - physicalToday);
  const videoRemaining = Math.max(0, videoQuota - videoToday);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

  return (
    <div className="space-y-4">
      <h2 className="text-lg md:text-xl font-bold">Weekly Schedule</h2>

      {/* Quota Card */}
      <Card className="p-4 rounded-xl space-y-4">
        <h4 className="font-medium text-sm">Today's Capacity</h4>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Physical
              </span>
              <span className="font-medium">{physicalToday}/{physicalQuota} <span className="text-muted-foreground">({physicalRemaining} left)</span></span>
            </div>
            <Progress value={physicalQuota > 0 ? (physicalToday / physicalQuota) * 100 : 0} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="flex items-center gap-2">
                <Video className="h-4 w-4 text-chart-2" /> Video
              </span>
              <span className="font-medium">{videoToday}/{videoQuota} <span className="text-muted-foreground">({videoRemaining} left)</span></span>
            </div>
            <Progress value={videoQuota > 0 ? (videoToday / videoQuota) * 100 : 0} className="h-2" />
          </div>
        </div>
      </Card>

      <Card className="rounded-xl overflow-hidden">
        <div className="divide-y">
          {schedule && typeof schedule === 'object' ? (
            Object.entries(schedule).map(([day, times]) => {
              const isToday = day === today;
              return (
                <div key={day} className={`p-3 md:p-4 flex items-center justify-between ${isToday ? 'bg-primary/5' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 md:h-10 md:w-10 rounded-xl flex items-center justify-center ${isToday ? 'bg-primary/20' : 'bg-primary/10'}`}>
                      <Calendar className={`h-4 w-4 md:h-5 md:w-5 ${isToday ? 'text-primary' : 'text-primary'}`} />
                    </div>
                    <div>
                      <p className={`font-medium capitalize text-sm md:text-base ${isToday ? 'text-primary' : ''}`}>{day}</p>
                      <p className="text-xs md:text-sm text-muted-foreground">{times.start} - {times.end}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isToday && <Badge className="bg-primary text-xs">Today</Badge>}
                    <Badge variant="outline" className="text-xs">Active</Badge>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No schedule configured</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
