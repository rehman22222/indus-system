import React, { useState, useEffect } from 'react';
import { summarizeChiefComplaint } from '@/lib/groqService';

interface ChiefComplaintSummaryProps {
    chiefComplaint: string;
    patientAge?: number;
    specialty?: string;
}

export function ChiefComplaintSummary({
    chiefComplaint,
    patientAge,
    specialty
}: ChiefComplaintSummaryProps) {
    const [summary, setSummary] = useState<string>('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!chiefComplaint || loading || summary) return;

        setLoading(true);
        summarizeChiefComplaint(chiefComplaint, patientAge, specialty).then(result => {
            if (result) setSummary(result);
            setLoading(false);
        });
    }, [chiefComplaint, patientAge, specialty, loading, summary]);

    if (!summary) return null;

    return (
        <p className="text-xs text-muted-foreground italic mt-1">
            🤖 {summary}
        </p>
    );
}
