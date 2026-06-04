import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { TopBar } from '@/components/shared/TopBar';
import { AdminSidebar, AdminTab } from '@/components/admin/AdminSidebar';
import { AdminOverview } from '@/components/admin/AdminOverview';
import { QueueMonitor } from '@/components/admin/QueueMonitor';
import { DoctorManagement } from '@/components/admin/DoctorManagement';
import { AppointmentManagement } from '@/components/admin/AppointmentManagement';
import { PatientList } from '@/components/admin/PatientList';
import { AdminSettings } from '@/components/admin/AdminSettings';
import { NotificationCenter } from '@/components/admin/NotificationCenter';
import { MLAnalytics } from '@/components/admin/MLAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export default function AdminPortal() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <AdminOverview selectedDate={selectedDate} />;
      case 'queue':
        return <QueueMonitor selectedDate={selectedDate} />;
      case 'doctors':
        return <DoctorManagement />;
      case 'appointments':
        return <AppointmentManagement selectedDate={selectedDate} />;
      case 'patients':
        return <PatientList selectedDate={selectedDate} />;
      case 'ml-analytics':
        return <MLAnalytics selectedDate={selectedDate} />;
      case 'notifications':
        return <NotificationCenter />;
      case 'settings':
        return <AdminSettings />;
      default:
        return <AdminOverview selectedDate={selectedDate} />;
    }
  };

  const goToToday = () => setSelectedDate(new Date());
  const isToday = isSameDay(selectedDate, new Date());
  const userName = user?.user_metadata?.full_name || user?.email || 'Admin';

  return (
    <div className="min-h-screen bg-background flex flex-col pb-16 md:pb-0">
      <TopBar userName={userName} userRole="System Administrator" onLogout={signOut} />

      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />

        <main className="flex-1 overflow-auto p-3 md:p-6">
          {/* Global Date Filter */}
          {activeTab !== 'settings' && activeTab !== 'notifications' && activeTab !== 'doctors' && activeTab !== 'ml-analytics' && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 mb-4 md:mb-6 bg-card p-3 md:p-4 rounded-2xl border border-border">
              <span className="text-sm font-medium text-muted-foreground shrink-0">Filter:</span>

              {/* Mobile: simple date input */}
              <Input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => e.target.value && setSelectedDate(new Date(e.target.value + 'T00:00:00'))}
                className="rounded-xl md:hidden h-10 w-full"
              />

              {/* Desktop: popover calendar */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "hidden md:flex w-[200px] justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              {!isToday && (
                <Button variant="ghost" size="sm" onClick={goToToday} className="shrink-0">
                  Today
                </Button>
              )}
              <div className="hidden lg:block ml-auto text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{format(selectedDate, "EEE, MMM d, yyyy")}</span>
              </div>
            </div>
          )}

          {renderContent()}
        </main>
      </div>
    </div>
  );
}
