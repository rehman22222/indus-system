// =================================================================
// useWebRTCCall — peer-to-peer video call over native WebRTC with
// MongoDB Realtime as the ONLY signaling channel.
//
// • getUserMedia() for camera + mic
// • getDisplayMedia() for screen share (RTCRtpSender.replaceTrack —
//   no renegotiation for the swap)
// • RTCPeerConnection with the project's STUN/TURN config
// • MongoDB Realtime broadcast for SDP + ICE exchange, presence to
//   detect when the second peer joins the room
// • ICE-failure auto-recovery: oniceconnectionstatechange →
//   'disconnected'|'failed' → restartIce() (caller re-offers with
//   iceRestart) and a 'reconnecting' status for the UI
//
// Deterministic negotiation (no glare handling needed): the DOCTOR is
// always the caller (creates the offer); the PATIENT answers. Room =
// the appointment id, so both sides land in the same channel.
// =================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@/integrations/mongodb/client';
import { MongoDB } from '@/integrations/mongodb/client';

export type CallRole = 'doctor' | 'patient';
export type CallStatus =
  | 'idle'
  | 'requesting-media'
  | 'waiting'        // in room, other peer not here yet
  | 'connecting'     // negotiating
  | 'connected'
  | 'reconnecting'   // ICE dropped, attempting restart
  | 'failed'
  | 'ended';

// Exact config required by the project (free STUN + open relay TURN).
const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

interface UseWebRTCCallArgs {
  roomId: string | undefined;
  role: CallRole;
  enabled: boolean;
}

export function useWebRTCCall({ roomId, role, enabled }: UseWebRTCCallArgs) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  // The real camera track, kept aside while a screen-share track is
  // substituted on the sender so we can swap back.
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const negotiated = useRef(false);
  const restarting = useRef(false);
  const endedRef = useRef(false);

  const cleanup = useCallback(() => {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    cameraTrackRef.current = null;
    if (channelRef.current) {
      MongoDB.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    pendingIce.current = [];
    negotiated.current = false;
    restarting.current = false;
  }, []);

  const endCall = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    try {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'bye',
        payload: { from: role },
      });
    } catch {
      /* channel may already be gone */
    }
    cleanup();
    setLocalStream(null);
    setRemoteStream(null);
    setIsScreenSharing(false);
    setStatus('ended');
  }, [cleanup, role]);

  const toggleAudio = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsAudioOn(track.enabled);
  }, []);

  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsVideoOn(track.enabled);
  }, []);

  const videoSender = () =>
    pcRef.current?.getSenders().find((s) => s.track?.kind === 'video') ?? null;

  const stopScreenShare = useCallback(async () => {
    const sender = videoSender();
    const cam = cameraTrackRef.current;
    if (sender && cam) await sender.replaceTrack(cam);
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    cameraTrackRef.current = null;
    setIsScreenSharing(false);
  }, []);

  const shareScreen = useCallback(async () => {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = display.getVideoTracks()[0];
      if (!screenTrack) return;
      const sender = videoSender();
      if (!sender) { display.getTracks().forEach((t) => t.stop()); return; }

      // Keep the live camera track so we can restore it.
      cameraTrackRef.current = sender.track ?? localStreamRef.current?.getVideoTracks()[0] ?? null;
      screenStreamRef.current = display;
      await sender.replaceTrack(screenTrack);
      setIsScreenSharing(true);

      // Browser "Stop sharing" UI ends the track → restore camera.
      screenTrack.onended = () => { void stopScreenShare(); };
    } catch (e) {
      // User cancelled the picker, or no permission — non-fatal.
      const name = (e as { name?: string })?.name;
      if (name !== 'NotAllowedError' && name !== 'AbortError') {
        setError('Screen share failed.');
      }
    }
  }, [stopScreenShare]);

  useEffect(() => {
    if (!enabled || !roomId) return;

    endedRef.current = false;
    let cancelled = false;

    const send = (event: string, payload: unknown) =>
      channelRef.current?.send({ type: 'broadcast', event, payload });

    const flushPendingIce = async () => {
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) return;
      const queued = pendingIce.current;
      pendingIce.current = [];
      for (const c of queued) {
        try { await pc.addIceCandidate(c); } catch { /* ignore bad candidate */ }
      }
    };

    const makeOffer = async (iceRestart = false) => {
      const pc = pcRef.current;
      if (!pc || role !== 'doctor') return;
      if (!iceRestart && negotiated.current) return;
      negotiated.current = true;
      const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
      await pc.setLocalDescription(offer);
      send('sdp', { from: role, description: pc.localDescription });
    };

    const attemptRecovery = () => {
      const pc = pcRef.current;
      if (!pc || endedRef.current || restarting.current) return;
      restarting.current = true;
      setStatus('reconnecting');
      try {
        pc.restartIce();
      } catch { /* older impls: fall through to re-offer */ }
      // The caller drives renegotiation with an ICE-restart offer.
      if (role === 'doctor') void makeOffer(true);
    };

    const start = async () => {
      try {
        setStatus('requesting-media');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = new RTCPeerConnection(ICE_CONFIG);
        pcRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        pc.ontrack = (e) => setRemoteStream(e.streams[0] ?? null);
        pc.onicecandidate = (e) => {
          if (e.candidate) send('ice', { from: role, candidate: e.candidate.toJSON() });
        };
        pc.onconnectionstatechange = () => {
          const s = pc.connectionState;
          if (s === 'connected') {
            restarting.current = false;
            setStatus('connected');
          } else if (s === 'failed') {
            attemptRecovery();
          }
        };
        pc.oniceconnectionstatechange = () => {
          const s = pc.iceConnectionState;
          if (s === 'disconnected' || s === 'failed') attemptRecovery();
          else if (s === 'connected' || s === 'completed') {
            restarting.current = false;
            if (!endedRef.current) setStatus('connected');
          }
        };

        const channel = MongoDB.channel(`webrtc-room-${roomId}`, {
          config: { broadcast: { self: false }, presence: { key: role } },
        });
        channelRef.current = channel;

        channel.on('broadcast', { event: 'sdp' }, async ({ payload }) => {
          const desc = payload?.description as RTCSessionDescriptionInit | undefined;
          if (!desc || payload?.from === role) return;
          const peer = pcRef.current;
          if (!peer) return;
          if (desc.type === 'offer' && role === 'patient') {
            await peer.setRemoteDescription(desc);
            await flushPendingIce();
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            send('sdp', { from: role, description: peer.localDescription });
            if (status !== 'connected') setStatus('connecting');
          } else if (desc.type === 'answer' && role === 'doctor') {
            await peer.setRemoteDescription(desc);
            await flushPendingIce();
          }
        });

        channel.on('broadcast', { event: 'ice' }, async ({ payload }) => {
          if (!payload?.candidate || payload?.from === role) return;
          const peer = pcRef.current;
          if (!peer) return;
          if (peer.remoteDescription) {
            try { await peer.addIceCandidate(payload.candidate); } catch { /* ignore */ }
          } else {
            pendingIce.current.push(payload.candidate);
          }
        });

        channel.on('broadcast', { event: 'bye' }, ({ payload }) => {
          if (payload?.from === role) return;
          endCall();
        });

        const maybeNegotiate = () => {
          const state = channel.presenceState() as Record<string, unknown[]>;
          const otherHere = Object.keys(state).some((k) => k !== role);
          if (otherHere) {
            if (role === 'doctor') { setStatus('connecting'); void makeOffer(); }
          } else if (!negotiated.current) {
            setStatus('waiting');
          }
        };
        channel.on('presence', { event: 'sync' }, maybeNegotiate);
        channel.on('presence', { event: 'join' }, maybeNegotiate);

        channel.subscribe(async (s) => {
          if (s === 'SUBSCRIBED') {
            await channel.track({ role, at: Date.now() });
            setStatus((prev) => (prev === 'requesting-media' ? 'waiting' : prev));
          } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
            setError('Signaling channel error.');
            setStatus('failed');
          }
        });
      } catch (e) {
        if (cancelled) return;
        const name = (e as { name?: string })?.name;
        setError(
          name === 'NotAllowedError'
            ? 'Camera/microphone permission denied.'
            : name === 'NotFoundError'
            ? 'No camera or microphone found.'
            : 'Could not start the video call.',
        );
        setStatus('failed');
      }
    };

    start();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, roomId, role]);

  return {
    status,
    error,
    localStream,
    remoteStream,
    isAudioOn,
    isVideoOn,
    isScreenSharing,
    toggleAudio,
    toggleVideo,
    shareScreen,
    stopScreenShare,
    endCall,
  };
}
