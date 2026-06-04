import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Stethoscope, Activity, MapPin, Video, LogOut, Mail, Phone } from 'lucide-react';
import type { Doctor } from '@/hooks/useDoctors';

interface DoctorProfileProps {
  doctor: Doctor;
  onLogout: () => void;
}

export function DoctorProfile({ doctor, onLogout }: DoctorProfileProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg md:text-xl font-bold">My Profile</h2>

      <Card className="p-4 md:p-6 rounded-xl space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Stethoscope className="h-7 w-7 md:h-8 md:w-8 text-primary" />
          </div>
          <div>
            <p className="text-base md:text-lg font-bold">{doctor.name}</p>
            <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
          </div>
        </div>

        <div className="grid gap-2 md:gap-3">
          {[
            { icon: Activity, label: 'Department', value: doctor.department?.name || 'Not assigned' },
            { icon: MapPin, label: 'Physical Quota', value: `${doctor.daily_physical_quota} patients/day` },
            { icon: Video, label: 'Video Quota', value: `${doctor.daily_video_quota} patients/day` },
            { icon: Mail, label: 'Email', value: doctor.email || 'Not set' },
            { icon: Phone, label: 'Phone', value: doctor.phone || 'Not set' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
              <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-medium text-sm truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Button variant="outline" className="w-full rounded-xl" onClick={onLogout}>
        <LogOut className="h-4 w-4 mr-2" />
        Sign Out
      </Button>
    </div>
  );
}
