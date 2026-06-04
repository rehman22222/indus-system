import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/shared/TopBar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Activity,
  TrendingUp,
  AlertTriangle,
  FileText,
  Radio,
  LogIn,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  useManagementStats,
  useManagementDoctors,
  useManagementAppointments,
  useManagementAlerts,
  useManagementBroadcast,
  useSlotManagement,
} from '@/hooks/useManagementData';

import { ManagementDashboard } from '@/components/management/ManagementDashboard';
import { CapacityManagement } from '@/components/management/CapacityManagement';
import { RosterBuilder } from '@/components/management/RosterBuilder';
import { PatientFlowManagement } from '@/components/management/PatientFlowManagement';
import { PerformanceMetrics } from '@/components/management/PerformanceMetrics';
import { AlertsPanel } from '@/components/management/AlertsPanel';
import { BroadcastPanel } from '@/components/management/BroadcastPanel';
import { ReportsPanel } from '@/components/management/ReportsPanel';

type Tab =
  | 'dashboard'
  | 'capacity'
  | 'roster'
  | 'flow'
  | 'performance'
  | 'alerts'
  | 'reports'
  | 'broadcast';

export default function ManagementPortal() {
  const navigate = useNavigate();
  const { user, roles, isLoading: authLoading, signIn, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [isSigningIn, setIsSigningIn] = useState(false);

  const { stats, isLoading: statsLoading } = useManagementStats(selectedDate);
  const { 
    doctors, isLoading: doctorsLoading, updateDoctorQuota, addEmergencySlots, updateDoctorSchedule,
  } = useManagementDoctors(selectedDate);
  const { 
    appointments, isLoading: appointmentsLoading, updateAppointmentStatus, reassignDoctor,
  } = useManagementAppointments(selectedDate);
  const { alerts } = useManagementAlerts(doctors, appointments);
  const { sendBroadcast, isSending } = useManagementBroadcast();
  const { isBlocked, toggleBlockAllSlots } = useSlotManagement();

  const isAuthorized = roles.includes('MANAGEMENT') || roles.includes('ADMIN');
  const isLoading = authLoading || statsLoading || doctorsLoading || appointmentsLoading;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);
    try {
      await signIn(loginForm.email, loginForm.password);
      toast.success('Signed in successfully');
    } catch (error: any) {
      toast.error(error.message || 'Sign in failed');
    } finally {
      setIsSigningIn(false);
    }
  };

  const tabs = [
    { id: 'dashboard' as Tab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'capacity' as Tab, label: 'Capacity', icon: Users },
    { id: 'roster' as Tab, label: 'Roster', icon: Calendar },
    { id: 'flow' as Tab, label: 'Flow', icon: Activity },
    { id: 'performance' as Tab, label: 'Metrics', icon: TrendingUp },
    { id: 'alerts' as Tab, label: 'Alerts', icon: AlertTriangle, badge: alerts.length },
    { id: 'reports' as Tab, label: 'Reports', icon: FileText },
    { id: 'broadcast' as Tab, label: 'Broadcast', icon: Radio },
  ];

  // Login screen
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopBar userName="Guest" userRole="Not signed in" />
        <div className="flex-1 flex items-center justify-center p-4 md:p-6">
          <Card className="w-full max-w-md p-6 md:p-8 rounded-3xl">
            <div className="text-center mb-6 md:mb-8">
              <h1 className="text-xl md:text-2xl font-bold text-foreground mb-2">Management Portal</h1>
              <p className="text-muted-foreground text-sm">Sign in to access OPD management</p>
            </div>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="Enter your email" value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} className="rounded-xl h-11" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="Enter your password" value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className="rounded-xl h-11" required />
              </div>
              <Button type="submit" className="w-full rounded-2xl h-12" disabled={isSigningIn}>
                <LogIn className="h-4 w-4 mr-2" />
                {isSigningIn ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  if (user && !isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopBar userName={user?.user_metadata?.full_name || 'User'} userRole="Unauthorized" onLogout={signOut} />
        <div className="flex-1 flex items-center justify-center p-4 md:p-6">
          <Card className="w-full max-w-md p-6 md:p-8 rounded-3xl text-center">
            <AlertTriangle className="h-12 w-12 md:h-16 md:w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-xl md:text-2xl font-bold text-foreground mb-2">Access Denied</h1>
            <p className="text-muted-foreground text-sm mb-6">You don't have permission to access the Management Portal.</p>
            <div className="space-y-2">
              <Button onClick={() => navigate('/')} className="w-full rounded-2xl">Go to Home</Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const userName = user?.user_metadata?.full_name || 'OPD Head';
  const userRole = 'Management';

  return (
    <div className="min-h-screen bg-background flex flex-col pb-16 md:pb-0">
      <TopBar userName={userName} userRole={userRole} onLogout={signOut} />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-56 lg:w-64 bg-card border-r border-border p-4 flex-col shrink-0">
          <div className="mb-4">
            <Label className="text-sm mb-2 block">Date</Label>
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="rounded-xl" />
          </div>
          <nav className="space-y-1 flex-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl font-medium transition-all text-sm",
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}>
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge && tab.badge > 0 && (
                    <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                      activeTab === tab.id ? 'bg-primary-foreground text-primary' : 'bg-destructive text-destructive-foreground'
                    )}>{tab.badge}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Mobile: Date filter + horizontal scroll tabs */}
        <div className="md:hidden flex flex-col w-full">
          <div className="px-3 pt-3 pb-2 flex items-center gap-2">
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-xl h-9 text-sm flex-1" />
          </div>
          <div className="overflow-x-auto px-3 pb-2">
            <div className="flex gap-1.5 min-w-max">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors",
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground'
                    )}>
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                    {tab.badge && tab.badge > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-destructive text-destructive-foreground">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <main className="flex-1 p-3 overflow-auto">
            {activeTab === 'dashboard' && <ManagementDashboard stats={stats} doctors={doctors} appointments={appointments} isLoading={isLoading} />}
            {activeTab === 'capacity' && <CapacityManagement doctors={doctors} isBlocked={isBlocked} onToggleBlock={toggleBlockAllSlots} onUpdateQuota={updateDoctorQuota} onAddEmergencySlots={addEmergencySlots} />}
            {activeTab === 'roster' && <RosterBuilder doctors={doctors} onUpdateSchedule={updateDoctorSchedule} />}
            {activeTab === 'flow' && <PatientFlowManagement doctors={doctors} appointments={appointments} onUpdateStatus={updateAppointmentStatus} onReassign={reassignDoctor} />}
            {activeTab === 'performance' && <PerformanceMetrics stats={stats} doctors={doctors} />}
            {activeTab === 'alerts' && <AlertsPanel alerts={alerts} onAddSlots={addEmergencySlots} />}
            {activeTab === 'reports' && <ReportsPanel stats={stats} doctors={doctors} appointments={appointments} date={selectedDate} />}
            {activeTab === 'broadcast' && <BroadcastPanel onSendBroadcast={sendBroadcast} isSending={isSending} />}
          </main>
        </div>

        {/* Desktop Content */}
        <main className="hidden md:block flex-1 p-6 overflow-auto">
          {activeTab === 'dashboard' && <ManagementDashboard stats={stats} doctors={doctors} appointments={appointments} isLoading={isLoading} />}
          {activeTab === 'capacity' && <CapacityManagement doctors={doctors} isBlocked={isBlocked} onToggleBlock={toggleBlockAllSlots} onUpdateQuota={updateDoctorQuota} onAddEmergencySlots={addEmergencySlots} />}
          {activeTab === 'roster' && <RosterBuilder doctors={doctors} onUpdateSchedule={updateDoctorSchedule} />}
          {activeTab === 'flow' && <PatientFlowManagement doctors={doctors} appointments={appointments} onUpdateStatus={updateAppointmentStatus} onReassign={reassignDoctor} />}
          {activeTab === 'performance' && <PerformanceMetrics stats={stats} doctors={doctors} />}
          {activeTab === 'alerts' && <AlertsPanel alerts={alerts} onAddSlots={addEmergencySlots} />}
          {activeTab === 'reports' && <ReportsPanel stats={stats} doctors={doctors} appointments={appointments} date={selectedDate} />}
          {activeTab === 'broadcast' && <BroadcastPanel onSendBroadcast={sendBroadcast} isSending={isSending} />}
        </main>
      </div>
    </div>
  );
}
