// =================================================================
// Call-invite signaling — MongoDB Realtime broadcast only.
//
// Channel: call-invite-<userId>  (the recipient's MongoDB auth uid)
// Events:
//   'call-invite'   doctor → patient : start a video call
//   'call-declined'  patient → doctor : invitation rejected
//
// No DB write, no third-party service — consistent with the WebRTC
// signaling rules.
// =================================================================

import { MongoDB } from '@/integrations/mongodb/client';

export interface CallInvitePayload {
  appointmentId: string;
  fromName: string;
  fromRole: 'doctor' | 'patient';
}

export const inviteChannelName = (userId: string) => `call-invite-${userId}`;

/**
 * Fire a one-shot invite at the recipient's invite channel, then tear
 * the transient sender channel down. Best-effort: a failure never
 * blocks the caller from entering the room (the recipient can still
 * join manually from their appointments list).
 */
export async function sendCallInvite(
  toUserId: string | undefined | null,
  payload: CallInvitePayload,
): Promise<void> {
  if (!toUserId) return;
  const ch = MongoDB.channel(inviteChannelName(toUserId));
  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };
    ch.subscribe((s) => {
      if (s === 'SUBSCRIBED') {
        ch.send({ type: 'broadcast', event: 'call-invite', payload }).finally(done);
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        done();
      }
    });
    // Safety timeout so we never hang the caller.
    setTimeout(done, 4000);
  });
  setTimeout(() => { MongoDB.removeChannel(ch); }, 1500);
}
