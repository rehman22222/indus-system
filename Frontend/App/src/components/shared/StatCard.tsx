import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: any;
  label: string;
  value: string | number;
  color: string;
  bg: string;
}

export function StatCard({ icon: Icon, label, value, color, bg }: StatCardProps) {
  return (
    <Card className="p-3 md:p-4 rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className={cn("h-10 w-10 md:h-12 md:w-12 rounded-xl flex items-center justify-center shrink-0", bg)}>
          <Icon className={cn("h-5 w-5 md:h-6 md:w-6", color)} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
          <p className="text-lg md:text-2xl font-bold text-foreground truncate">{value}</p>
        </div>
      </div>
    </Card>
  );
}
