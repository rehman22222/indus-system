import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Loader2, AlertCircle,
  MonitorUp, MonitorX,
} from 'lucide-react';
import { useWebRTCCall, type CallRole, type CallStatus } from '@/hooks/useWebRTCCall';

interface VideoConsultationProps {
  appointmentId: string;
  /** 'doctor' is the caller, 'patient' answers. */
  role: CallRole;
  /** Name shown for the remote participant. */
  peerName?: string;
  onEnd: () => void;
}

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: 'Starting…',
  'requesting-media': 'Requesting camera & mic…',
  waiting: 'Waiting for the other participant…',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  failed: 'Disconnected',
  ended: 'Call ended',
};

export function VideoConsultation({ appointmentId, role, peerName, onEnd }: VideoConsultationProps) {
  const {
    status, error, localStream, remoteStream,
    isAudioOn, isVideoOn, isScreenSharing,
    toggleAudio, toggleVideo, shareScreen, stopScreenShare, endCall,
  } = useWebRTCCall({ roomId: appointmentId, role, enabled: true });

  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const prevStatus = useRef<CallStatus>('idle');

  useEffect(() => {
    if (localRef.current && localStream) localRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current && remoteStream) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  // Status-transition toasts (Phase 3 polish).
  useEffect(() => {
    const prev = prevStatus.current;
    if (status === prev) return;
    if (status === 'connected' && prev !== 'connected') {
      toast.success('Call connected');
    } else if (status === 'reconnecting') {
      toast.warning('Connection unstable — reconnecting…');
    } else if (status === 'failed' && (prev === 'connected' || prev === 'reconnecting')) {
      toast.error('Peer disconnected');
    } else if (status === 'ended') {
      toast('Call ended');
    }
    prevStatus.current = status;
  }, [status]);

  // Surface the call ending (peer hung up / fatal error) to the parent.
  useEffect(() => {
    if (status === 'ended') onEnd();
  }, [status, onEnd]);

  const hangUp = () => {
    endCall();
    onEnd();
  };

  const connected = status === 'connected';

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white/90">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Video className="h-4 w-4" /> Video Consultation
        </div>
        <div className="flex items-center gap-2">
          {isScreenSharing && (
            <Badge variant="outline" className="border-amber-400 text-amber-300 gap-1">
              <MonitorUp className="h-3 w-3" /> Sharing screen
            </Badge>
          )}
          <Badge variant={connected ? 'default' : 'secondary'}>
            {STATUS_LABEL[status]}
          </Badge>
        </div>
      </div>

      {/* Stage */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover bg-neutral-900"
        />

        {!remoteStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
            {error ? (
              <>
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p className="text-sm max-w-xs text-center">{error}</p>
              </>
            ) : (
              <>
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">{STATUS_LABEL[status]}</p>
                {peerName && <p className="text-xs text-white/50">with {peerName}</p>}
              </>
            )}
          </div>
        )}

        {/* Reconnecting banner over a live (but unstable) call */}
        {status === 'reconnecting' && remoteStream && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-amber-500/90 text-black text-sm font-medium px-3 py-1.5 rounded-full">
            <Loader2 className="h-4 w-4 animate-spin" /> Reconnecting…
          </div>
        )}

        {/* Local PiP — muted to avoid echo */}
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-4 right-4 h-36 w-28 md:h-44 md:w-32 rounded-xl object-cover border border-white/20 shadow-lg bg-neutral-800"
        />
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-3 md:gap-4 py-5 bg-black">
        <Button
          variant={isAudioOn ? 'secondary' : 'destructive'}
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={toggleAudio}
          aria-label={isAudioOn ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isAudioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        <Button
          variant={isVideoOn ? 'secondary' : 'destructive'}
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={toggleVideo}
          aria-label={isVideoOn ? 'Turn camera off' : 'Turn camera on'}
        >
          {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>
        <Button
          variant={isScreenSharing ? 'default' : 'secondary'}
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={() => (isScreenSharing ? stopScreenShare() : shareScreen())}
          aria-label={isScreenSharing ? 'Stop screen share' : 'Share screen'}
        >
          {isScreenSharing ? <MonitorX className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
        </Button>
        <Button
          variant="destructive"
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={hangUp}
          aria-label="End call"
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

export default VideoConsultation;
