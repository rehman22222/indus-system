import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Pill, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import type { Prescription } from '@/hooks/usePrescriptions';

interface DoctorPrescriptionsProps {
  prescriptions: Prescription[];
  isLoading: boolean;
  onSelect: (rx: Prescription) => void;
}

export function DoctorPrescriptions({ prescriptions, isLoading, onSelect }: DoctorPrescriptionsProps) {
  if (isLoading) {
    return <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg md:text-xl font-bold">Prescription History</h2>
      <p className="text-xs md:text-sm text-muted-foreground">View all prescriptions you've written</p>

      {prescriptions.length === 0 ? (
        <div className="p-8 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No prescriptions yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {prescriptions.map((rx) => (
            <Card key={rx.id} className="p-3 md:p-4 rounded-xl cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.98]"
              onClick={() => onSelect(rx)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-chart-3/10 flex items-center justify-center shrink-0">
                    <Pill className="h-4 w-4 md:h-5 md:w-5 text-chart-3" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{rx.diagnosis}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(rx.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
