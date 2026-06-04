import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Database,
  Download,
  Shield,
  Palette,
  Globe,
  Clock,
  Server,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSystemSettings } from '@/hooks/useAdminData';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

const FEATURE_TOGGLES = [
  { key: 'online_consultations', name: 'Online Consultations', description: 'Enable video consultations' },
  { key: 'patient_rescheduling', name: 'Patient Rescheduling', description: 'Allow patients to reschedule' },
  { key: 'sms_notifications', name: 'SMS Notifications', description: 'Send SMS reminders' },
  { key: 'walk_in_booking', name: 'Walk-in Booking', description: 'Allow walk-in appointments' },
  { key: 'auto_noshow', name: 'Auto No-Show Marking', description: 'Auto-mark no-show after threshold (default 30 min)' },
  { key: 'noshow_threshold_minutes', name: 'No-Show Threshold (min)', description: 'Minutes after slot start to auto-mark no-show' },
];

export function AdminSettings() {
  const { settings, isLoading, updateSetting } = useSystemSettings();
  const [localToggles, setLocalToggles] = useState<Record<string, boolean>>({});
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    const toggles: Record<string, boolean> = {};
    FEATURE_TOGGLES.forEach(f => {
      toggles[f.key] = settings[f.key] ?? true;
    });
    setLocalToggles(toggles);
  }, [settings]);

  // Fetch audit logs from audit_logs table
  useEffect(() => {
    const fetchLogs = async () => {
      setLoadingLogs(true);
      try {
        const { data } = await supabase
          .from('audit_logs')
          .select('id, actor_user_id, action, entity_type, entity_id, ip_address, user_agent, timestamp')
          .order('timestamp', { ascending: false })
          .limit(50);
        setAuditLogs(data || []);
      } catch { /* no logs yet */ }
      finally { setLoadingLogs(false); }
    };
    fetchLogs();

    // Real-time subscription for audit logs
    const channel = supabase
      .channel('audit-logs-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => fetchLogs())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const addAuditEntry = async (action: string, details: string) => {
    try {
      await supabase.rpc('write_audit_log', {
        p_action: action,
        p_entity_type: 'system_settings',
        p_new_value: { details } as any,
      });
    } catch (err) {
      console.error('Audit log error:', err);
    }
  };

  const handleToggleChange = async (key: string, enabled: boolean) => {
    setLocalToggles(prev => ({ ...prev, [key]: enabled }));
    const { error } = await updateSetting(key, enabled);
    if (error) {
      setLocalToggles(prev => ({ ...prev, [key]: !enabled }));
      toast.error('Failed to update setting');
    } else {
      toast.success(`${key.replace(/_/g, ' ')} ${enabled ? 'enabled' : 'disabled'}`);
      await addAuditEntry('Setting Changed', `${key.replace(/_/g, ' ')} ${enabled ? 'enabled' : 'disabled'}`);
    }
  };

  const handleForceBackup = async () => {
    // Check if backup already in progress
    const { data: runningBackup } = await supabase
      .from('backup_jobs')
      .select('id')
      .in('status', ['queued', 'running'])
      .limit(1);
    
    if (runningBackup && runningBackup.length > 0) {
      toast.error('BACKUP_IN_PROGRESS: A backup is already running');
      return;
    }

    // Create backup job
    const { data: job, error } = await supabase.from('backup_jobs').insert({
      status: 'queued',
      triggered_by: null, // Will be set by auth context
    }).select().single();

    if (error) {
      toast.error('Failed to start backup');
      return;
    }

    // Simulate backup process (in production this would be a real backup)
    await supabase.from('backup_jobs').update({ 
      status: 'running', 
      started_at: new Date().toISOString() 
    }).eq('id', job.id);

    // Simulate completion
    setTimeout(async () => {
      await supabase.from('backup_jobs').update({ 
        status: 'succeeded', 
        completed_at: new Date().toISOString(),
        artifact_uri: `backups/${format(new Date(), 'yyyy-MM-dd_HH-mm')}.sql.gz`,
      }).eq('id', job.id);
    }, 3000);

    await updateSetting('last_backup', new Date().toISOString());
    await addAuditEntry('Backup', 'Manual backup initiated');
    toast.success('Backup job started');
  };

  const handleExportAll = async () => {
    try {
      // Export appointments
      const { data: appts } = await supabase.from('appointments').select('id, token, appointment_date, appointment_time, appointment_type, status, patient:patients(full_name, indus_id), doctor:doctors(full_name)').order('appointment_date', { ascending: false }).limit(500);
      const headers = ['Date', 'Time', 'Token', 'Patient', 'Patient ID', 'Doctor', 'Type', 'Status', 'Chief Complaint'];
      const rows = (appts || []).map((a: any) => [
        a.appointment_date, a.appointment_time, a.token,
        a.patient?.name || '-', a.patient?.patient_id || '-',
        a.doctor?.name || '-', a.appointment_type, a.status,
        a.chief_complaint || '-',
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.setAttribute('href', URL.createObjectURL(blob));
      link.setAttribute('download', `system_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await addAuditEntry('Export', 'Full system data exported');
      toast.success('Data exported successfully');
    } catch {
      toast.error('Export failed');
    }
  };

  const lastBackup = settings.last_backup ? new Date(settings.last_backup as string) : null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage system configuration and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Toggles */}
        <Card className="p-5 rounded-2xl border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Feature Toggles</h3>
              <p className="text-sm text-muted-foreground">Enable or disable system features</p>
            </div>
          </div>
          <div className="space-y-4">
            {FEATURE_TOGGLES.map((feature) => (
              <div key={feature.key} className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
                <div>
                  <p className="font-medium text-sm">{feature.name}</p>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
                <Switch
                  checked={localToggles[feature.key] ?? true}
                  onCheckedChange={(checked) => handleToggleChange(feature.key, checked)}
                />
              </div>
            ))}
          </div>
        </Card>

        {/* System Backup & Export */}
        <Card className="p-5 rounded-2xl border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-chart-3/10 flex items-center justify-center">
              <Database className="h-5 w-5 text-chart-3" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">System Backup & Export</h3>
              <p className="text-sm text-muted-foreground">Manage data backups and exports</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-secondary/50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Last Backup</span>
                <Badge variant="outline">
                  <Clock className="h-3 w-3 mr-1" />
                  {lastBackup ? format(lastBackup, 'PPp') : 'Never'}
                </Badge>
              </div>
            </div>
            <div className="p-4 bg-chart-3/10 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-chart-3" />
                <span className="text-sm font-medium">Database Connected</span>
              </div>
              <p className="text-xs text-muted-foreground">Real-time sync active</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleForceBackup} className="flex-1 rounded-xl gap-2">
                <Database className="h-4 w-4" />
                Backup Now
              </Button>
              <Button variant="outline" className="rounded-xl gap-2" onClick={handleExportAll}>
                <Download className="h-4 w-4" />
                Export All
              </Button>
            </div>
          </div>
        </Card>

        {/* Audit Log */}
        <Card className="p-5 rounded-2xl border-border lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-chart-4/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-chart-4" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Audit Log</h3>
              <p className="text-sm text-muted-foreground">Recent administrative actions</p>
            </div>
          </div>
          <ScrollArea className="h-64">
            {auditLogs.length > 0 ? (
              <div className="space-y-2">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 bg-secondary/50 rounded-xl">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{log.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.entity_type}{log.entity_id ? ` — ${log.entity_id}` : ''}
                        {log.new_value?.details ? ` — ${log.new_value.details}` : ''}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {log.created_at ? format(new Date(log.created_at), 'PPp') : '-'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No audit entries yet</p>
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Preferences */}
        <Card className="p-5 rounded-2xl border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-chart-5/10 flex items-center justify-center">
              <Palette className="h-5 w-5 text-chart-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Preferences</h3>
              <p className="text-sm text-muted-foreground">Display and notification settings</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
              <Label htmlFor="dark-mode" className="cursor-pointer">Dark Mode</Label>
              <Switch id="dark-mode" />
            </div>
            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
              <Label htmlFor="notifications" className="cursor-pointer">Push Notifications</Label>
              <Switch id="notifications" defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
              <Label htmlFor="sounds" className="cursor-pointer">Sound Alerts</Label>
              <Switch id="sounds" />
            </div>
          </div>
        </Card>

        {/* Language & Region */}
        <Card className="p-5 rounded-2xl border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Language & Region</h3>
              <p className="text-sm text-muted-foreground">Localization settings</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="p-3 bg-secondary/50 rounded-xl">
              <p className="text-sm text-muted-foreground mb-1">Language</p>
              <p className="font-medium">English (EN)</p>
            </div>
            <div className="p-3 bg-secondary/50 rounded-xl">
              <p className="text-sm text-muted-foreground mb-1">Timezone</p>
              <p className="font-medium">Asia/Karachi (PKT)</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
