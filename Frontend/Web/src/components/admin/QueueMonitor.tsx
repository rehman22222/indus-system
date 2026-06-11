import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { MongoDB } from '@/integrations/mongodb/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import {
  Clock, UserCheck, Stethoscope, CheckCircle2, AlertTriangle,
  Timer, RefreshCw, Users, Activity,
} from 'lucide-react';

interface QueueItem {
  id: string;
  token: string;
  status: string;
  appointment_type: string;
  appointment_time: string;
  check_in_time: string | null;
  consultation_start_time: string | null;
  patient: { full_name: string; indus_id: string | null } | null;
  doctor: { full_name: string; specialty: string } | null;
}

interface QueueMonitorProps {
  selectedDate: Date;
}

export function QueueMonitor({ selectedDate }: QueueMonitorProps) {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);

  const fetchQueue = useCallback(async () => {
    try {
      setIsLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      const { data, error } = await MongoDB
        .from('appointments')
        .select(`
          id, token, status, appointment_type, appointment_time,
          check_in_time, consultation_start_time, doctor_id,
          patient:patients(full_name, indus_id),
          doctor:doctors(full_name, specialty)
        `)
        .eq('appointment_date', dateStr)
        .in('status', ['confirmed', 'waiting', 'in_consultation', 'completed'])
        .order('appointment_time');

      if (error) throw error;

      let items = (data || []) as unknown as (QueueItem & { doctor_id: string })[];
      if (doctorFilter !== 'all') {
        items = items.filter(i => i.doctor_id === doctorFilter);
      }

      setQueueItems(items);

      // Get unique doctors
      const uniqueDocs = new Map<string, string>();
      (data || []).forEach((d: any) => {
        if (d.doctor_id && d.doctor?.full_name) uniqueDocs.set(d.doctor_id, d.doctor.full_name);
      });
      setDoctors(Array.from(uniqueDocs, ([id, name]) => ({ id, name })));
    } catch (err) {
      console.error('Queue fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, doctorFilter]);

  useEffect(() => {
    fetchQueue();
    const channel = MongoDB
      .channel('queue-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchQueue())
      .subscribe();
    return () => { MongoDB.removeChannel(channel); };
  }, [fetchQueue]);

  const notArrived = useMemo(() => queueItems.filter(i => i.status === 'confirmed'), [queueItems]);
  const waiting = useMemo(() => queueItems.filter(i => i.status === 'waiting'), [queueItems]);
  const inConsult = useMemo(() => queueItems.filter(i => i.status === 'in_consultation'), [queueItems]);
  const completed = useMemo(() => queueItems.filter(i => i.status === 'completed'), [queueItems]);

  const avgWait = useMemo(() => {
    const items = queueItems.filter(i => i.check_in_time && i.consultation_start_time);
    if (!items.length) return 0;
    const total = items.reduce((s, i) => {
      return s + (new Date(i.consultation_start_time!).getTime() - new Date(i.check_in_time!).getTime());
    }, 0);
    return Math.round(total / items.length / 60000);
  }, [queueItems]);

  const StatusColumn = memo(({ title, icon: Icon, items, color, bgColor }: {
    title: string; icon: any; items: QueueItem[]; color: string; bgColor: string;
  }) => (
    <Card className="p-4 rounded-2xl flex-1 min-w-[240px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg ${bgColor} flex items-center justify-center`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        <Badge variant="outline" className="text-xs">{items.length}</Badge>
      </div>
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No patients</p>
          ) : items.map(item => (
            <div key={item.id} className={`p-3 rounded-xl border ${bgColor} border-transparent`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono font-bold text-sm">{item.token}</span>
                <Badge variant="outline" className="text-[10px]">
                  {item.appointment_type === 'video' ? '📹 Video' : '🏥 Physical'}
                </Badge>
              </div>
              <p className="text-sm font-medium truncate">{item.patient?.full_name || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground">{item.patient?.indus_id || ''}</p>
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Stethoscope className="h-3 w-3" />
                <span className="truncate">{item.doctor?.full_name}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{item.appointment_time}</span>
                {item.check_in_time && (
                  <span className="ml-auto">Checked in: {format(new Date(item.check_in_time), 'HH:mm')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  ));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[460px] rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Queue Monitor</h1>
          <p className="text-muted-foreground text-sm">
            Real-time patient flow for {format(selectedDate, 'MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={doctorFilter} onValueChange={setDoctorFilter}>
            <SelectTrigger className="w-[180px] rounded-xl">
              <SelectValue placeholder="All Doctors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Doctors</SelectItem>
              {doctors.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchQueue} className="rounded-xl">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Not Arrived', value: notArrived.length, color: 'text-muted-foreground' },
          { label: 'Waiting', value: waiting.length, color: 'text-chart-4' },
          { label: 'In Consult', value: inConsult.length, color: 'text-chart-5' },
          { label: 'Completed', value: completed.length, color: 'text-chart-3' },
          { label: 'Avg Wait', value: `${avgWait}m`, color: 'text-primary' },
        ].map(s => (
          <Card key={s.label} className="p-3 rounded-xl text-center">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Queue columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatusColumn title="Not Arrived" icon={AlertTriangle} items={notArrived} color="text-muted-foreground" bgColor="bg-secondary/50" />
        <StatusColumn title="Waiting" icon={Timer} items={waiting} color="text-chart-4" bgColor="bg-chart-4/10" />
        <StatusColumn title="In Consult" icon={Activity} items={inConsult} color="text-chart-5" bgColor="bg-chart-5/10" />
        <StatusColumn title="Completed" icon={CheckCircle2} items={completed} color="text-chart-3" bgColor="bg-chart-3/10" />
      </div>
    </div>
  );
}
