import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut } from 'lucide-react';
import indusLogo from '@/assets/indus-logo.svg';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: 'Patient' | 'Doctor';
  userName?: string;
  userSubtitle?: string;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  tabs: { id: string; icon: any; label: string }[];
}

export function DashboardLayout({
  children,
  role,
  userName,
  userSubtitle,
  onLogout,
  activeTab,
  setActiveTab,
  tabs
}: DashboardLayoutProps) {
  const handleLogout = () => {
    onLogout();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-16 md:pb-0">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-2.5 sticky top-0 z-20 safe-area-top">
        <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <img src={indusLogo} alt="Indus Hospital" className="h-7 md:h-9" />
            <span className="hidden md:block text-sm font-bold text-foreground">{role} Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold leading-tight text-foreground">{userName}</p>
              <p className="text-[10px] text-muted-foreground font-medium">{userSubtitle}</p>
            </div>
            {/* Mobile user info - more compact */}
            <div className="text-right sm:hidden">
              <p className="text-xs font-bold leading-tight text-foreground">{userName?.split(' ')[0]}</p>
              <p className="text-[9px] text-muted-foreground">{userSubtitle?.split(' ')[0]}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-xl h-9 w-9 hover:bg-destructive/10 hover:text-destructive transition-colors">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-3 md:p-6 overflow-x-hidden">
        <div className="max-w-4xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-2 py-1.5 md:hidden safe-area-bottom z-30 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around max-w-md mx-auto">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex flex-col items-center py-1.5 px-3 rounded-xl transition-all duration-200 min-w-[64px]",
                activeTab === id
                  ? "text-primary bg-primary/5 scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Icon className={cn("h-5 w-5", activeTab === id && "animate-in zoom-in-75")} />
              <span className={cn("text-[10px] mt-1 font-bold tracking-tight", activeTab === id ? "opacity-100" : "opacity-80")}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
