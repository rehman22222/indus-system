import { useEffect, useRef, useState } from 'react';
import AgoraRTC, {
  type IAgoraRTCClient,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2 } from 'lucide-react';

interface AgoraCallProps {
  appId: string;
  channel: string;
  token?: string | null;
  uid?: number;
  userName?: string;
  embedded?: boolean;
  onEnd: () => void;
}

/**
 * Agora RTC call surface (doctor / web patient). Joins the appointment channel,
 * publishes mic + camera, and renders the remote participant full-screen with a
 * local picture-in-picture. Runs on any HTTPS/localhost origin — no tunnel.
 */
export function AgoraCall({ appId, channel, token, uid, userName, embedded = false, onEnd }: AgoraCallProps) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const micRef = useRef<IMicrophoneAudioTrack | null>(null);
  const camRef = useRef<ICameraVideoTrack | null>(null);
  const localRef = useRef<HTMLDivElement>(null);
  const remoteRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<'connecting' | 'waiting' | 'connected' | 'error'>('connecting');
  const [error, setError] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    clientRef.current = client;

    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === 'video' && remoteRef.current) user.videoTrack?.play(remoteRef.current);
      if (mediaType === 'audio') user.audioTrack?.play();
      if (!cancelled) setStatus('connected');
    });
    client.on('user-left', () => {
      if (!cancelled) setStatus(client.remoteUsers.length ? 'connected' : 'waiting');
    });

    (async () => {
      try {
        await client.join(appId, channel, token || null, uid ?? null);
        if (cancelled) return;
        setStatus('waiting');
        const mic = await AgoraRTC.createMicrophoneAudioTrack();
        micRef.current = mic;
        const tracks: (IMicrophoneAudioTrack | ICameraVideoTrack)[] = [mic];
        try {
          const cam = await AgoraRTC.createCameraVideoTrack();
          camRef.current = cam;
          if (localRef.current) cam.play(localRef.current);
          tracks.push(cam);
        } catch {
          setCamOn(false);
        }
        await client.publish(tracks);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not connect the call');
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      micRef.current?.close();
      camRef.current?.close();
      client.removeAllListeners();
      client.leave().catch(() => {});
    };
  }, [appId, channel, token, uid]);

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    micRef.current?.setEnabled(next);
  };
  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    camRef.current?.setEnabled(next);
  };

  return (
    <div className={`${embedded ? 'absolute' : 'fixed z-[120]'} inset-0 bg-[#0B1220] flex flex-col`}>
      <div className="relative flex-1">
        {/* Remote */}
        <div ref={remoteRef} className="absolute inset-0 bg-black" />
        {status !== 'connected' && (
          <div data-testid="agora-status" className="absolute inset-0 flex flex-col items-center justify-center text-center gap-3 text-white px-6">
            {status === 'error' ? (
              <>
                <p className="text-lg font-bold text-[#F2616D]">Call failed</p>
                <p className="text-sm text-[#9AA8BD] max-w-sm">{error}</p>
              </>
            ) : (
              <>
                <Loader2 className="h-9 w-9 animate-spin" />
                <p className="text-base font-semibold">
                  {status === 'connecting' ? 'Connecting…' : 'Waiting for the patient to join…'}
                </p>
              </>
            )}
          </div>
        )}
        {/* Local PiP */}
        <div
          ref={localRef}
          className="absolute top-4 right-4 w-28 h-40 md:w-36 md:h-52 rounded-xl overflow-hidden bg-black border border-white/25"
          style={{ display: camOn ? 'block' : 'none' }}
        />
        <div className="absolute top-4 left-4 text-xs text-white/70 bg-black/40 rounded-lg px-2 py-1">
          {userName || 'Doctor'}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-5 py-5 bg-black/30">
        <button aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'} onClick={toggleMic} className={`h-14 w-14 rounded-full flex items-center justify-center ${micOn ? 'bg-white/15' : 'bg-[#F2616D]/40'} text-white`}>
          {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </button>
        <button aria-label="End consultation" onClick={onEnd} className="h-16 w-16 rounded-full bg-[#BE1E2D] flex items-center justify-center text-white">
          <PhoneOff className="h-7 w-7" />
        </button>
        <button aria-label={camOn ? 'Turn camera off' : 'Turn camera on'} onClick={toggleCam} className={`h-14 w-14 rounded-full flex items-center justify-center ${camOn ? 'bg-white/15' : 'bg-[#F2616D]/40'} text-white`}>
          {camOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
        </button>
      </div>
    </div>
  );
}

export default AgoraCall;
