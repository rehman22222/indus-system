import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Lock, Unlock, Plus, Save } from 'lucide-react';
import type { DoctorWithStats } from '@/hooks/useManagementData';

interface CapacityManagementProps {
  doctors: DoctorWithStats[];
  isBlocked: boolean;
  onToggleBlock: () => void;
  onUpdateQuota: (doctorId: string, physical: number, video: number) => void;
  onAddEmergencySlots: (doctorId: string, slots: number) => void;
}

export function CapacityManagement({
  doctors,
  isBlocked,
  onToggleBlock,
  onUpdateQuota,
  onAddEmergencySlots,
}: CapacityManagementProps) {
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false);
  const [selectedDoctorForQuota, setSelectedDoctorForQuota] = useState<string | null>(null);
  const [quotaForm, setQuotaForm] = useState({ physical: '', video: '' });

  const specialties = [...new Set(doctors.map(d => d.specialty))];
  
  const filteredDoctors = doctors.filter(d => {
    if (!d.is_active) return false;
    if (selectedDoctor && d.id !== selectedDoctor) return false;
    if (selectedSpecialty && d.specialty !== selectedSpecialty) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">Doctor Capacity Management</h1>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant={isBlocked ? 'default' : 'destructive'} className="gap-2 rounded-2xl">
              {isBlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              {isBlocked ? 'Unblock All Slots' : 'Block All Slots'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isBlocked ? 'Unblock All Slots?' : 'Block All Appointment Slots?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isBlocked 
                  ? 'This will re-enable booking for all available appointment slots.'
                  : 'This will immediately block all available appointment slots across the system. Patients will not be able to book new appointments until slots are reopened.'
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onToggleBlock}
                className={isBlocked ? '' : 'bg-destructive text-destructive-foreground'}
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

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

      {/* Doctors Table */}
      <Card className="rounded-3xl shadow-sm border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">Doctor</th>
                <th className="px-6 py-4 text-left font-semibold">Specialty</th>
                <th className="px-6 py-4 text-left font-semibold">Department</th>
                <th className="px-6 py-4 text-left font-semibold">Physical Quota</th>
                <th className="px-6 py-4 text-left font-semibold">Video Quota</th>
                <th className="px-6 py-4 text-left font-semibold">Seen</th>
                <th className="px-6 py-4 text-left font-semibold">Remaining</th>
                <th className="px-6 py-4 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredDoctors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                    No doctors found
                  </td>
                </tr>
              ) : (
                filteredDoctors.map((doctor) => (
                  <tr key={doctor.id} className="hover:bg-accent/50">
                    <td className="px-6 py-4 font-medium">{doctor.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{doctor.specialty}</td>
                    <td className="px-6 py-4">
                      {doctor.department ? (
                        <Badge style={{ backgroundColor: doctor.department.color, color: 'white' }}>
                          {doctor.department.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">{doctor.daily_physical_quota}</td>
                    <td className="px-6 py-4">{doctor.daily_video_quota}</td>
                    <td className="px-6 py-4 font-medium">{doctor.seen}</td>
                    <td className="px-6 py-4">
                      <Badge variant={doctor.remaining < 5 ? 'destructive' : 'secondary'}>
                        {doctor.remaining}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => onAddEmergencySlots(doctor.id, 5)}
                        className="rounded-xl gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        +5
                      </Button>
                      <Dialog 
                        open={quotaDialogOpen && selectedDoctorForQuota === doctor.id} 
                        onOpenChange={(open) => {
                          setQuotaDialogOpen(open);
                          if (!open) {
                            setSelectedDoctorForQuota(null);
                            setQuotaForm({ physical: '', video: '' });
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => {
                              setSelectedDoctorForQuota(doctor.id);
                              setQuotaForm({
                                physical: doctor.daily_physical_quota.toString(),
                                video: doctor.daily_video_quota.toString(),
                              });
                            }}
                          >
                            Edit
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Quota - {doctor.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Physical Appointments Quota</Label>
                              <Input
                                type="number"
                                placeholder="Physical quota"
                                value={quotaForm.physical}
                                onChange={(e) => setQuotaForm({ ...quotaForm, physical: e.target.value })}
                                className="rounded-xl"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Video Appointments Quota</Label>
                              <Input
                                type="number"
                                placeholder="Video quota"
                                value={quotaForm.video}
                                onChange={(e) => setQuotaForm({ ...quotaForm, video: e.target.value })}
                                className="rounded-xl"
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={() => {
                                const physical = parseInt(quotaForm.physical) || 0;
                                const video = parseInt(quotaForm.video) || 0;
                                onUpdateQuota(doctor.id, physical, video);
                                setQuotaDialogOpen(false);
                                setQuotaForm({ physical: '', video: '' });
                              }}
                              className="rounded-2xl"
                            >
                              <Save className="h-4 w-4 mr-2" />
                              Save
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
