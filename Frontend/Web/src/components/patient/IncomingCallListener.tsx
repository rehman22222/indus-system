import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@/integrations/mongodb/client';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { toast } from 'sonner';
import { MongoDB } from '@/integrations/mongodb/client';
import { inviteChannelName, type CallInvitePayload } from '@/lib/callInvite';

/**
 * App-wide listener (mounted in the patient dashboard) for incoming
 * video-call invites broadcast by the doctor on
 * `call-invite-<patientUserId>`. Shows an Accept / Decline banner.
 * Accept → parent opens the call for that appointment. Decline →
 * broadcasts `call-declined` back to the doctor.
 */
export function IncomingCallListener({
  userId,
  onAccept,
}: {
  userId?: string;
  onAccept: (appointmentId: string) => void;
}) {
  const [invite, setInvite] = useState<CallInvitePayload | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId) return;
    const ch = MongoDB.channel(inviteChannelName(userId));
    channelRef.current = ch;
    ch.on('broadcast', { event: 'call-invite' }, ({ payload }) => {
      setInvite(payload as CallInvitePayload);
      toast.info(`Incoming call from ${(payload as CallInvitePayload).fromName}`);
    }).subscribe();

    return () => {
      MongoDB.removeChannel(ch);
      channelRef.current = null;
    };
  }, [userId]);

  if (!invite) return null;

  const decline = () => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'call-declined',
      payload: { appointmentId: invite.appointmentId },
    });
    setInvite(null);
  };

  const accept = () => {
    const id = invite.appointmentId;
    setInvite(null);
    onAccept(id);
  };

  return (
    <div className="fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card shadow-xl p-4 flex items-center gap-3 animate-slide-down">
        <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Video className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">Incoming video call</p>
          <p className="text-xs text-muted-foreground truncate">from {invite.fromName}</p>
        </div>
        <Button
          size="icon"
          variant="destructive"
          className="rounded-full h-10 w-10 shrink-0"
          onClick={decline}
          aria-label="Decline call"
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          className="rounded-full h-10 w-10 shrink-0 bg-green-600 hover:bg-green-700 text-white"
          onClick={accept}
          aria-label="Accept call"
        >
          <Phone className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default IncomingCallListener;
