import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Activity,
  Settings,
  Shield,
  Bell,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export type AdminTab = 'overview' | 'queue' | 'doctors' | 'appointments' | 'patients' | 'settings' | 'notifications' | 'ml-analytics';

interface AdminSidebarProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const navItems = [
  { id: 'overview' as AdminTab, label: 'Overview', icon: LayoutDashboard },
  { id: 'queue' as AdminTab, label: 'Queue', icon: ListOrdered },
  { id: 'appointments' as AdminTab, label: 'Appointments', icon: Calendar },
  { id: 'doctors' as AdminTab, label: 'Doctors', icon: Users },
  { id: 'patients' as AdminTab, label: 'Patients', icon: Activity },
  { id: 'ml-analytics' as AdminTab, label: 'ML Analytics', icon: Brain },
  { id: 'notifications' as AdminTab, label: 'Notifications', icon: Bell },
  { id: 'settings' as AdminTab, label: 'Settings', icon: Settings },
];

export function AdminSidebar({ activeTab, setActiveTab, collapsed, setCollapsed }: AdminSidebarProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex bg-card border-r border-border flex-col transition-all duration-300",
        collapsed ? "w-20" : "w-64"
      )}>
        <div className={cn(
          "h-16 border-b border-border flex items-center px-4",
          collapsed ? "justify-center" : "justify-between"
        )}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground">Admin</span>
            </div>
          )}
          {collapsed && (
            <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-all",
                  collapsed && "justify-center",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          <button
            className={cn(
              "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all",
              collapsed && "justify-center"
            )}
          >
            <HelpCircle className="h-5 w-5" />
            {!collapsed && <span>Help & Support</span>}
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn("w-full", collapsed && "px-0")}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && <span className="ml-2">Collapse</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-[52px]",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-tight">{item.label.split(' ')[0]}</span>
              </button>
            );
          })}
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-[52px]",
              activeTab === 'settings' ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Settings className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-tight">Settings</span>
          </button>
        </div>
      </nav>
    </>
  );
}
