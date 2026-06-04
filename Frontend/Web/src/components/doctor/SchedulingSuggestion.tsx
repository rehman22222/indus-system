import React, { useState, useEffect } from 'react';
import { Lightbulb } from 'lucide-react';
import { getSchedulingSuggestion } from '@/lib/groqService';

interface SchedulingSuggestionProps {
    doctorName: string;
    specialty: string;
    usedSlots: number;
    totalSlots: number;
    pendingRequests: number;
}

export function SchedulingSuggestion({
    doctorName,
    specialty,
    usedSlots,
    totalSlots,
    pendingRequests
}: SchedulingSuggestionProps) {
    const [suggestion, setSuggestion] = useState<string>('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Only call Groq if utilization > 70%
        const utilization = usedSlots / totalSlots;
        if (utilization <= 0.7 || loading || suggestion) return;

        setLoading(true);
        getSchedulingSuggestion(
            doctorName,
            specialty,
            usedSlots,
            totalSlots,
            pendingRequests
        ).then(result => {
            if (result) setSuggestion(result);
            setLoading(false);
        });
    }, [doctorName, specialty, usedSlots, totalSlots, pendingRequests, loading, suggestion]);

    if (!suggestion) return null;

    return (
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-200">{suggestion}</p>
        </div>
    );
}
