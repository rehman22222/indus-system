import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import indusLogo from '@/assets/indus-logo.svg';
import { Shield, Activity, Calendar, Stethoscope, QrCode, User } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  const portals = [
    {
      title: 'Patient App',
      subtitle: 'Book & Manage',
      desc: 'Appointments, prescriptions & profile',
      icon: User,
      route: '/patient',
      color: 'bg-accent',
      iconColor: 'text-accent-foreground',
      btnClass: 'bg-accent hover:bg-accent/90 text-accent-foreground',
    },
    {
      title: 'Doctor Portal',
      subtitle: 'Consultant Access',
      desc: 'View patients & consultations',
      icon: Stethoscope,
      route: '/doctor',
      color: 'bg-chart-3',
      iconColor: 'text-white',
      btnClass: 'bg-chart-3 hover:bg-chart-3/90 text-white',
    },
    {
      title: 'Management',
      subtitle: 'OPD Leadership',
      desc: 'Quotas, scheduling & oversight',
      icon: Activity,
      route: '/management',
      color: 'bg-primary/10',
      iconColor: 'text-primary',
      btnClass: '',
    },
    {
      title: 'Admin Portal',
      subtitle: 'System Guardian',
      desc: 'Users, security & settings',
      icon: Shield,
      route: '/admin',
      color: 'bg-destructive/10',
      iconColor: 'text-destructive',
      btnClass: '',
      variant: 'destructive' as const,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-accent flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8 md:mb-12">
          <img src={indusLogo} alt="Indus Hospital" className="h-16 md:h-20 mx-auto mb-4 md:mb-6" />
          <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-2 md:mb-3">Smart Appointment System</h1>
          <p className="text-sm md:text-lg text-muted-foreground">Enterprise Portal Access</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {portals.map((p) => (
            <Card key={p.route} className="p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-lg border hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              onClick={() => navigate(p.route)}>
              <div className="text-center space-y-3 md:space-y-6">
                <div className={`h-14 w-14 md:h-20 md:w-20 rounded-2xl md:rounded-3xl ${p.color} flex items-center justify-center mx-auto`}>
                  <p.icon className={`h-7 w-7 md:h-10 md:w-10 ${p.iconColor}`} />
                </div>
                <div>
                  <h2 className="text-sm md:text-2xl font-bold text-foreground mb-0.5 md:mb-2">{p.title}</h2>
                  <p className="text-[10px] md:text-sm text-muted-foreground">{p.subtitle}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground hidden md:block mt-1">{p.desc}</p>
                </div>
                <Button onClick={(e) => { e.stopPropagation(); navigate(p.route); }}
                  size="lg" variant={p.variant || 'default'}
                  className={`w-full rounded-xl md:rounded-2xl text-xs md:text-base h-9 md:h-auto ${p.btnClass}`}>
                  Access
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-4 md:mt-6 text-center">
          <Button variant="outline" onClick={() => navigate('/check-in')} className="rounded-xl gap-2 text-xs md:text-sm">
            <QrCode className="h-4 w-4" /> Patient Check-In Kiosk
          </Button>
        </div>

        <div className="mt-4 md:mt-8 text-center">
          <p className="text-xs md:text-sm text-muted-foreground">Real-time sync enabled • Role-based access</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
