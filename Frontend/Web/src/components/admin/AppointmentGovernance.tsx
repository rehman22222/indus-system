import React, { useState } from 'react';
import { MongoDB } from '@/integrations/mongodb/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface AppointmentGovernanceProps {
    appointmentId: string;
    currentStatus: 'pending' | 'approved' | 'rejected';
    managerId: string;
    onUpdate: () => void;
}

export function AppointmentGovernance({
    appointmentId, currentStatus, managerId, onUpdate
}: AppointmentGovernanceProps) {
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGovernance = async (action: 'approved' | 'rejected') => {
        setLoading(true);
        setError(null);
        try {
            const { error: updateError } = await MongoDB
                .from('appointments')
                .update({
                    governance_status: action,
                    governance_note: note || null,
                    governed_by: managerId,
                    governed_at: new Date().toISOString(),
                    status: action === 'approved' ? 'confirmed' : 'cancelled',
                } as any)
                .eq('id', appointmentId);

            if (updateError) throw updateError;

            // Write audit log
            await MongoDB.from('audit_logs').insert({
                actor_user_id: managerId,
                action: `appointment_${action}`,
                entity_type: 'appointments',
                entity_id: appointmentId,
                after: { governance_status: action, note },
                timestamp: new Date().toISOString(),
            } as any);

            onUpdate();
        } catch (err: any) {
            setError(err?.message || 'Action failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const statusBadge = {
        pending: <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>,
        approved: <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>,
        rejected: <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>,
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">{statusBadge[currentStatus]}</div>
            {currentStatus === 'pending' && (
                <>
                    <Textarea
                        placeholder="Optional governance note..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="text-sm"
                        rows={2}
                    />
                    {error && <p className="text-destructive text-sm">{error}</p>}
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            onClick={() => handleGovernance('approved')}
                            disabled={loading}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleGovernance('rejected')}
                            disabled={loading}
                        >
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}
