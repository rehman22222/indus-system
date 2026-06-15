import { useRef, useState } from 'react';
import AgoraRTC, {
  type IAgoraRTCClient,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const CHANNEL = 'indus-test';

type Phase = 'idle' | 'joining' | 'joined' | 'error';

/**
 * Standalone Agora connectivity check. Open this page in two tabs / two devices
 * and click "Join call" — if you see and hear the other side, the Agora App ID +
 * Certificate work and we can wire Agora in as the consultation provider.
 */
export default function AgoraTest() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [log, setLog] = useState<string[]>([]);
  const [remotes, setRemotes] = useState(0);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const micRef = useRef<IMicrophoneAudioTrack | null>(null);
  const camRef = useRef<ICameraVideoTrack | null>(null);
  const localRef = useRef<HTMLDivElement>(null);
  const remoteRef = useRef<HTMLDivElement>(null);

  const append = (line: string) => setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${line}`]);

  async function join() {
    try {
      setPhase('joining');
      const uid = Math.floor(Math.random() * 1_000_000) + 1;
      append(`Requesting token for uid ${uid}…`);
      const res = await fetch(`${API_BASE}/api/v1/video/agora-test-token?channel=${CHANNEL}&uid=${uid}`);
      if (!res.ok) throw new Error(`token endpoint ${res.status}`);
      const { appId, channel, token } = await res.json();
      append(`Got Agora credentials (appId ${String(appId).slice(0, 8)}…). Joining "${channel}"…`);

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        append(`Remote ${user.uid} published ${mediaType}`);
        if (mediaType === 'video' && remoteRef.current) user.videoTrack?.play(remoteRef.current);
        if (mediaType === 'audio') user.audioTrack?.play();
        setRemotes(client.remoteUsers.length);
      });
      client.on('user-left', () => setRemotes(client.remoteUsers.length));
      client.on('connection-state-change', (cur) => append(`Connection: ${cur}`));

      await client.join(appId, channel, token || null, uid);
      append('Joined channel. Publishing…');

      const mic = await AgoraRTC.createMicrophoneAudioTrack();
      micRef.current = mic;
      const tracks: (IMicrophoneAudioTrack | ICameraVideoTrack)[] = [mic];
      try {
        const cam = await AgoraRTC.createCameraVideoTrack();
        camRef.current = cam;
        if (localRef.current) cam.play(localRef.current);
        tracks.push(cam);
      } catch {
        append('Camera unavailable (often in use by another tab) — joining with audio only.');
      }
      await client.publish(tracks);
      append('Published. ✅ You are live — open this page in another tab/device.');
      setPhase('joined');
    } catch (err) {
      append(`❌ ${err instanceof Error ? err.message : String(err)}`);
      setPhase('error');
    }
  }

  async function leave() {
    micRef.current?.close();
    camRef.current?.close();
    await clientRef.current?.leave().catch(() => {});
    micRef.current = null;
    camRef.current = null;
    clientRef.current = null;
    setRemotes(0);
    setPhase('idle');
    append('Left call.');
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0B1220', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif', padding: 20 }}>
      <h1 style={{ margin: '4px 0' }}>Agora connectivity test</h1>
      <p style={{ color: '#9AA8BD', marginTop: 0 }}>
        Open this page in <b>two tabs or two devices</b> and join. Seeing/hearing the other side confirms Agora works.
      </p>

      <div style={{ display: 'flex', gap: 12, margin: '12px 0' }}>
        {phase === 'joined' ? (
          <button onClick={leave} style={btn('#BE1E2D')}>Leave call</button>
        ) : (
          <button onClick={join} disabled={phase === 'joining'} style={btn('#15814A')}>
            {phase === 'joining' ? 'Joining…' : 'Join call'}
          </button>
        )}
        <span style={{ alignSelf: 'center', color: '#9AA8BD' }}>
          Channel: <b style={{ color: '#fff' }}>{CHANNEL}</b> · Remote participants: <b style={{ color: '#fff' }}>{remotes}</b>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={label}>You</div>
          <div ref={localRef} style={video} />
        </div>
        <div>
          <div style={label}>Remote</div>
          <div ref={remoteRef} style={video} />
        </div>
      </div>

      <div style={{ marginTop: 14, background: '#141E30', borderRadius: 10, padding: 12, fontSize: 13, maxHeight: 220, overflowY: 'auto' }}>
        {log.length === 0 ? <span style={{ color: '#6B7A92' }}>Log will appear here…</span> : log.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
}

const btn = (bg: string): React.CSSProperties => ({
  background: bg, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer',
});
const label: React.CSSProperties = { color: '#9AA8BD', fontSize: 12, marginBottom: 6, fontWeight: 700 };
const video: React.CSSProperties = { width: '100%', aspectRatio: '3 / 4', maxHeight: '52vh', background: '#000', borderRadius: 12, overflow: 'hidden' };
