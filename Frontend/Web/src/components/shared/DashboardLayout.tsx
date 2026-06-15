import React from 'react';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import indusLogo from '@/assets/indus-logo.svg';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  const initials = (userName || role)
    .replace(/^Dr\.?\s+/i, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-transparent flex flex-col pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-20 px-3 pt-3 md:px-6 md:pt-5 safe-area-top">
        <div className="brand-panel flex min-h-[68px] items-center justify-between gap-3 max-w-6xl mx-auto w-full rounded-2xl md:rounded-3xl px-3.5 py-2.5 md:px-5 shadow-[0_14px_35px_rgba(18,38,67,0.2)]">
          <div className="flex min-w-0 items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="rounded-xl bg-white px-2 py-1.5 shadow-sm">
              <img src={indusLogo} alt="Indus Hospital" className="h-7 w-auto md:h-8" />
            </div>
            <div className="hidden lg:block border-l border-white/20 pl-3">
              <p className="text-sm font-extrabold text-white">{role} Portal</p>
              <p className="text-[10px] font-medium text-white/60">Smart Healthcare Management</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 rounded-2xl bg-white/10 p-1">
            {tabs.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all',
                  activeTab === id
                    ? 'bg-white text-[#1B365D] shadow-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden sm:block text-right">
              <p className="max-w-[140px] truncate text-sm font-bold leading-tight text-white">{userName}</p>
              <p className="max-w-[140px] truncate text-[10px] font-medium text-white/60">{userSubtitle || role}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-xs font-extrabold text-white ring-1 ring-white/20">
              {initials}
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out" className="h-9 w-9 rounded-xl text-white/75 hover:bg-white/10 hover:text-white">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-3 py-4 md:px-6 md:py-7 overflow-x-hidden">
        <div className="max-w-6xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-border/80 bg-card/95 px-2 pb-1 pt-1.5 backdrop-blur-xl md:hidden safe-area-bottom z-30 shadow-[0_-10px_28px_rgba(15,30,51,0.08)]">
        <div className="flex justify-around max-w-md mx-auto">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex min-w-[60px] flex-col items-center rounded-xl px-2 py-1.5 transition-all duration-200",
                activeTab === id
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Icon className={cn("h-5 w-5", activeTab === id && "animate-in zoom-in-75")} />
              <span className={cn("text-[10px] mt-1 font-bold tracking-tight", activeTab === id ? "opacity-100" : "opacity-75")}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
