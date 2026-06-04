import { useState, memo, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2 } from 'lucide-react';
import { explainNoShowRisk } from '@/lib/groqService';
import { getNoShowRiskLabel } from '@/lib/noShowPredictor';
import type { NoShowRiskLabel } from '@/integrations/supabase/types';

interface NoShowRiskBadgeProps {
    score?: number;
    factors?: string[];
    specialty?: string;
    appointmentType?: string;
    appointmentTime?: string;
}

const LABEL_CONFIG: Record<NoShowRiskLabel, { variant: 'default' | 'secondary' | 'destructive'; text: string; color: string }> = {
    low: { variant: 'default', text: 'Low Risk', color: 'text-green-600' },
    medium: { variant: 'secondary', text: 'Medium Risk', color: 'text-yellow-600' },
    high: { variant: 'destructive', text: 'High Risk', color: 'text-red-600' },
};

export const NoShowRiskBadge = memo(function NoShowRiskBadge({
    score,
    factors = [],
    specialty = 'General Medicine',
    appointmentType = 'physical',
    appointmentTime = '09:00'
}: NoShowRiskBadgeProps) {
    const [aiExplanation, setAiExplanation] = useState<string>('');
    const [loadingAI, setLoadingAI] = useState(false);

    // Compute label from score client-side (memoized)
    const label = useMemo(() => getNoShowRiskLabel(score), [score]);
    const config = useMemo(() => LABEL_CONFIG[label], [label]);
    const displayScore = score ?? 0;

    const loadExplanation = useCallback(async () => {
        if (aiExplanation || loadingAI || label === 'low') return;
        setLoadingAI(true);
        const explanation = await explainNoShowRisk(
            label,
            displayScore,
            specialty,
            appointmentType,
            appointmentTime,
            factors
        );
        setAiExplanation(explanation);
        setLoadingAI(false);
    }, [aiExplanation, loadingAI, label, displayScore, specialty, appointmentType, appointmentTime, factors]);

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger onMouseEnter={loadExplanation}>
                    <Badge variant={config.variant} className="cursor-pointer" data-testid="noshowbadge">
                        {config.text} ({Math.round(displayScore * 100)}%)
                    </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                    <div className="space-y-2">
                        <p className="font-semibold text-sm">Risk Factors:</p>
                        {factors.length > 0 ? (
                            <ul className="text-xs list-disc ml-3 space-y-0.5">
                                {factors.map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                        ) : (
                            <p className="text-xs">No significant risk factors.</p>
                        )}
                        {label !== 'low' && (
                            <div className="border-t pt-2 mt-2">
                                <p className="font-semibold text-sm mb-1">AI Recommendation:</p>
                                {loadingAI ? (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Analyzing...
                                    </div>
                                ) : aiExplanation ? (
                                    <p className="text-xs">{aiExplanation}</p>
                                ) : (
                                    <p className="text-xs text-muted-foreground">Hover to load AI insight.</p>
                                )}
                            </div>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
});
