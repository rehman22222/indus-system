import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingUp, Activity, Info } from 'lucide-react';
import type { Alert } from '@/hooks/useManagementData';

interface AlertsPanelProps {
  alerts: Alert[];
  onAddSlots?: (doctorId: string) => void;
}

export function AlertsPanel({ alerts, onAddSlots }: AlertsPanelProps) {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'danger': return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'warning': return <TrendingUp className="h-5 w-5 text-chart-4" />;
      case 'info': return <Info className="h-5 w-5 text-primary" />;
      default: return <Activity className="h-5 w-5 text-chart-3" />;
    }
  };

  const getAlertBorderColor = (type: string) => {
    switch (type) {
      case 'danger': return 'border-l-destructive';
      case 'warning': return 'border-l-chart-4';
      case 'info': return 'border-l-primary';
      default: return 'border-l-chart-3';
    }
  };

  const handleAction = (alert: Alert) => {
    if (alert.actionLabel === 'Add Slots' && alert.doctorId && onAddSlots) {
      onAddSlots(alert.doctorId);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Predictive Alerts</h1>
      
      {alerts.length === 0 ? (
        <Card className="p-8 rounded-3xl shadow-sm border-border text-center">
          <Activity className="h-12 w-12 text-chart-3 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">All Systems Normal</h3>
          <p className="text-muted-foreground">
            No alerts at this time. The system is operating within expected parameters.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <Card 
              key={alert.id} 
              className={`p-6 rounded-3xl shadow-sm border-l-4 ${getAlertBorderColor(alert.type)}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    {getAlertIcon(alert.type)}
                    {alert.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {alert.description}
                  </p>
                </div>
                {alert.actionLabel && (
                  <Button 
                    size="sm" 
                    className="rounded-xl"
                    onClick={() => handleAction(alert)}
                  >
                    {alert.actionLabel}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
