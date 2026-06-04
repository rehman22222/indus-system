import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, ChevronLeft, ChevronRight, Calendar, Clock, Users } from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameMonth, startOfMonth, endOfMonth, eachWeekOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DoctorWithStats } from '@/hooks/useManagementData';

interface RosterBuilderProps {
  doctors: DoctorWithStats[];
  onUpdateSchedule: (doctorId: string, schedule: Record<string, { start: string; end: string }>) => void;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function RosterBuilder({ doctors, onUpdateSchedule }: RosterBuilderProps) {
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [editingDoctor, setEditingDoctor] = useState<DoctorWithStats | null>(null);
  const [scheduleForm, setScheduleForm] = useState<Record<string, { start: string; end: string; enabled: boolean }>>({});

  // Week/Month navigation
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  const specialties = [...new Set(doctors.map(d => d.specialty))];

  const filteredDoctors = doctors.filter(d => {
    if (!d.is_active) return false;
    if (selectedDoctor && d.id !== selectedDoctor) return false;
    if (selectedSpecialty && d.specialty !== selectedSpecialty) return false;
    return true;
  });

  // Get the current week's dates
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekDates = DAYS.map((_, i) => addDays(weekStart, i));

  // Get all weeks of the current month for month view
  const monthWeeks = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });
    return weeks.map(weekStart => DAYS.map((_, i) => addDays(weekStart, i)));
  }, [currentDate]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1));
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  const goToToday = () => setCurrentDate(new Date());

  const openEditDialog = (doctor: DoctorWithStats) => {
    setEditingDoctor(doctor);
    const form: Record<string, { start: string; end: string; enabled: boolean }> = {};
    DAYS.forEach(day => {
      const existing = doctor.schedule?.[day] as { start: string; end: string } | undefined;
      form[day] = {
        start: existing?.start || '09:00',
        end: existing?.end || '17:00',
        enabled: !!existing,
      };
    });
    setScheduleForm(form);
  };

  const handleSaveSchedule = () => {
    if (!editingDoctor) return;
    const newSchedule: Record<string, { start: string; end: string }> = {};
    Object.entries(scheduleForm).forEach(([day, times]) => {
      if (times.enabled) {
        newSchedule[day] = { start: times.start, end: times.end };
      }
    });
    onUpdateSchedule(editingDoctor.id, newSchedule);
    setEditingDoctor(null);
  };

  // Get the day name from a Date for matching against schedule
  const getDayName = (date: Date): string => {
    return DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1];
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  // Stats
  const activeDoctorsCount = filteredDoctors.length;
  const totalSlots = filteredDoctors.reduce((sum, d) => {
    const workingDays = DAYS.filter(day => d.schedule?.[day]).length;
    return sum + (d.daily_physical_quota + d.daily_video_quota) * workingDays;
  }, 0);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground">Roster Builder</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage weekly doctor schedules</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={viewMode === 'week' ? 'default' : 'outline'} size="sm" className="rounded-xl text-xs"
            onClick={() => setViewMode('week')}>Week</Button>
          <Button variant={viewMode === 'month' ? 'default' : 'outline'} size="sm" className="rounded-xl text-xs"
            onClick={() => setViewMode('month')}>Month</Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 md:p-4 rounded-xl">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] md:text-xs text-muted-foreground">Active Doctors</p>
              <p className="text-lg md:text-xl font-bold">{activeDoctorsCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 md:p-4 rounded-xl">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-chart-3/10 flex items-center justify-center">
              <Calendar className="h-4 w-4 md:h-5 md:w-5 text-chart-3" />
            </div>
            <div>
              <p className="text-[10px] md:text-xs text-muted-foreground">Weekly Slots</p>
              <p className="text-lg md:text-xl font-bold">{totalSlots}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 md:p-4 rounded-xl">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-chart-2/10 flex items-center justify-center">
              <Clock className="h-4 w-4 md:h-5 md:w-5 text-chart-2" />
            </div>
            <div>
              <p className="text-[10px] md:text-xs text-muted-foreground">Specialties</p>
              <p className="text-lg md:text-xl font-bold">{specialties.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-3 md:p-4 rounded-2xl border-border">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Label className="text-xs mb-1.5 block">Doctor</Label>
            <Select value={selectedDoctor || 'all'} onValueChange={(v) => setSelectedDoctor(v === 'all' ? null : v)}>
              <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="All Doctors" /></SelectTrigger>
              <SelectContent className="bg-background border-border">
                <SelectItem value="all">All Doctors</SelectItem>
                {doctors.filter(d => d.is_active).map(doc => (
                  <SelectItem key={doc.id} value={doc.id}>{doc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label className="text-xs mb-1.5 block">Specialty</Label>
            <Select value={selectedSpecialty || 'all'} onValueChange={(v) => setSelectedSpecialty(v === 'all' ? null : v)}>
              <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="All Specialties" /></SelectTrigger>
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

      {/* Week/Month Navigation */}
      <Card className="p-3 md:p-4 rounded-2xl border-border">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9"
            onClick={() => viewMode === 'week' ? navigateWeek('prev') : navigateMonth('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <p className="font-semibold text-sm md:text-base">
              {viewMode === 'week'
                ? `${format(weekDates[0], 'MMM d')} — ${format(weekDates[6], 'MMM d, yyyy')}`
                : format(currentDate, 'MMMM yyyy')
              }
            </p>
            {viewMode === 'week' && (
              <p className="text-[10px] md:text-xs text-muted-foreground">
                Week {format(weekStart, 'w')} of {format(currentDate, 'yyyy')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="rounded-xl text-xs h-8" onClick={goToToday}>Today</Button>
            <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9"
              onClick={() => viewMode === 'week' ? navigateWeek('next') : navigateMonth('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Week View */}
      {viewMode === 'week' && (
        <Card className="rounded-2xl border-border overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-8 border-b bg-secondary/30">
            <div className="p-2 md:p-3 text-xs font-medium text-muted-foreground border-r">Doctor</div>
            {weekDates.map((date, i) => (
              <div key={i} className={cn(
                "p-2 md:p-3 text-center border-r last:border-r-0",
                isToday(date) && "bg-primary/5"
              )}>
                <p className="text-[10px] md:text-xs font-medium text-muted-foreground">{DAY_SHORT[i]}</p>
                <p className={cn(
                  "text-xs md:text-sm font-bold mt-0.5",
                  isToday(date) ? "text-primary" : "text-foreground"
                )}>{format(date, 'd')}</p>
              </div>
            ))}
          </div>

          {/* Doctor Rows */}
          <div className="divide-y max-h-[60vh] overflow-y-auto">
            {filteredDoctors.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No doctors found</div>
            ) : (
              filteredDoctors.map((doctor) => (
                <div key={doctor.id} className="grid grid-cols-8 hover:bg-secondary/20 transition-colors">
                  {/* Doctor Info */}
                  <div className="p-2 md:p-3 border-r flex flex-col justify-center min-w-0">
                    <p className="font-medium text-xs md:text-sm truncate">{doctor.name.replace('Dr. ', '')}</p>
                    <p className="text-[9px] md:text-[10px] text-muted-foreground truncate">{doctor.specialty}</p>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] mt-1 rounded-lg px-2 w-fit"
                      onClick={() => openEditDialog(doctor)}>Edit</Button>
                  </div>

                  {/* Day Cells */}
                  {weekDates.map((date, i) => {
                    const dayName = getDayName(date);
                    const schedule = doctor.schedule?.[dayName] as { start: string; end: string } | undefined;
                    return (
                      <div key={i} className={cn(
                        "p-1.5 md:p-2 border-r last:border-r-0 flex items-center justify-center",
                        isToday(date) && "bg-primary/5",
                        !schedule && "opacity-40"
                      )}>
                        {schedule ? (
                          <div className="bg-chart-3/10 border border-chart-3/20 rounded-lg p-1 md:p-1.5 w-full text-center">
                            <p className="text-[8px] md:text-[10px] font-medium text-chart-3">{schedule.start}</p>
                            <p className="text-[7px] md:text-[9px] text-muted-foreground">{schedule.end}</p>
                          </div>
                        ) : (
                          <span className="text-[9px] md:text-[10px] text-muted-foreground">Off</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Month View */}
      {viewMode === 'month' && (
        <div className="space-y-3">
          {filteredDoctors.map((doctor) => (
            <Card key={doctor.id} className="rounded-2xl border-border overflow-hidden">
              <div className="p-3 md:p-4 border-b bg-secondary/30 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm md:text-base">{doctor.name}</h3>
                  <p className="text-[10px] md:text-xs text-muted-foreground">{doctor.specialty}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] md:text-xs">
                    {DAYS.filter(d => doctor.schedule?.[d]).length} days/wk
                  </Badge>
                  <Button variant="outline" size="sm" className="rounded-xl text-xs h-8"
                    onClick={() => openEditDialog(doctor)}>Edit</Button>
                </div>
              </div>

              {/* Month Grid */}
              <div>
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b">
                  {DAY_SHORT.map(d => (
                    <div key={d} className="p-1.5 md:p-2 text-center text-[10px] md:text-xs font-medium text-muted-foreground">{d}</div>
                  ))}
                </div>
                {/* Week rows */}
                {monthWeeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
                    {week.map((date, di) => {
                      const dayName = getDayName(date);
                      const schedule = doctor.schedule?.[dayName] as { start: string; end: string } | undefined;
                      const inMonth = isSameMonth(date, currentDate);
                      return (
                        <div key={di} className={cn(
                          "p-1 md:p-1.5 min-h-[40px] md:min-h-[52px] border-r last:border-r-0",
                          !inMonth && "opacity-30",
                          isToday(date) && "bg-primary/5"
                        )}>
                          <p className={cn(
                            "text-[9px] md:text-[10px] font-medium",
                            isToday(date) ? "text-primary" : "text-foreground"
                          )}>{format(date, 'd')}</p>
                          {schedule && inMonth ? (
                            <div className="bg-chart-3/10 rounded p-0.5 mt-0.5">
                              <p className="text-[7px] md:text-[8px] text-chart-3 font-medium text-center">
                                {schedule.start}-{schedule.end}
                              </p>
                            </div>
                          ) : inMonth ? (
                            <p className="text-[7px] md:text-[8px] text-muted-foreground mt-0.5 text-center">Off</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Schedule Dialog */}
      <Dialog open={!!editingDoctor} onOpenChange={(open) => !open && setEditingDoctor(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden rounded-2xl p-0">
          <DialogHeader className="p-4 md:p-5 border-b">
            <DialogTitle className="text-base md:text-lg">Edit Schedule — {editingDoctor?.name}</DialogTitle>
          </DialogHeader>
          <div className="p-4 md:p-5 space-y-2 max-h-[55vh] overflow-y-auto">
            {DAYS.map((day, i) => (
              <div key={day} className={cn(
                "flex items-center gap-3 p-3 rounded-xl transition-colors",
                scheduleForm[day]?.enabled ? "bg-chart-3/5 border border-chart-3/20" : "bg-secondary/50"
              )}>
                <Switch
                  checked={scheduleForm[day]?.enabled || false}
                  onCheckedChange={(checked) => setScheduleForm({
                    ...scheduleForm,
                    [day]: { ...scheduleForm[day], enabled: checked }
                  })}
                />
                <span className="capitalize font-medium text-sm w-12 shrink-0">{DAY_SHORT[i]}</span>
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    type="time"
                    value={scheduleForm[day]?.start || '09:00'}
                    onChange={(e) => setScheduleForm({
                      ...scheduleForm,
                      [day]: { ...scheduleForm[day], start: e.target.value }
                    })}
                    disabled={!scheduleForm[day]?.enabled}
                    className="rounded-lg h-9 text-sm flex-1"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={scheduleForm[day]?.end || '17:00'}
                    onChange={(e) => setScheduleForm({
                      ...scheduleForm,
                      [day]: { ...scheduleForm[day], end: e.target.value }
                    })}
                    disabled={!scheduleForm[day]?.enabled}
                    className="rounded-lg h-9 text-sm flex-1"
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="p-4 md:p-5 border-t gap-2">
            <Button variant="outline" onClick={() => setEditingDoctor(null)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSaveSchedule} className="rounded-xl">
              <Save className="h-4 w-4 mr-2" /> Save Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
