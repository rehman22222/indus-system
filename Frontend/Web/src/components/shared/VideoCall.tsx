import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, PhoneOff, ShieldCheck, Video } from 'lucide-react';

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => {
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      dispose: () => void;
    };
  }
}

interface VideoCallProps {
  /** Room URL from the backend create-room endpoint. */
  roomUrl: string;
  /** Display name shown to the other participant. */
  userName?: string;
  /** Provider from the backend (default 'jitsi'). Non-Jitsi URLs render as a plain hosted iframe. */
  provider?: string;
  /** Called when the user leaves the call. */
  onEnd: () => void;
}

let jitsiScriptPromise: Promise<void> | null = null;

function loadJitsiScript(domain: string): Promise<void> {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  if (jitsiScriptPromise) return jitsiScriptPromise;
  jitsiScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      jitsiScriptPromise = null;
      reject(new Error('Failed to load Jitsi'));
    };
    document.body.appendChild(script);
  });
  return jitsiScriptPromise;
}

function parseRoom(roomUrl: string) {
  try {
    const url = new URL(roomUrl);
    return { domain: url.host, room: url.pathname.replace(/^\/+/, '') };
  } catch {
    return { domain: 'meet.jit.si', room: roomUrl };
  }
}

/**
 * Full-screen video consultation.
 *  - Jitsi (default): embedded via the official Jitsi IFrame API (free, no API
 *    key). Detects hang-up to return to the dashboard.
 *  - Any other provider: embedded as a plain hosted iframe.
 * An "Open in browser" button is always available as a fallback if embedding is
 * blocked by the provider.
 */
export function VideoCall({ roomUrl, userName, provider, onEnd }: VideoCallProps) {
  const isJitsi = (provider || '').toLowerCase() === 'jitsi' || /jit\.si/.test(roomUrl);
  const isBrowserOnly = (provider || '').toLowerCase() === 'webrtc';
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{ dispose: () => void } | null>(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const [loaded, setLoaded] = useState(false);

  // --- Jitsi IFrame API path ---
  useEffect(() => {
    if (!isJitsi || !roomUrl) return;
    let cancelled = false;
    const { domain, room } = parseRoom(roomUrl);

    loadJitsiScript(domain)
      .then(() => {
        if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) return;
        const api = new window.JitsiMeetExternalAPI(domain, {
          roomName: room,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          userInfo: { displayName: userName || 'Participant' },
          configOverwrite: {
            // Skip the "Join meeting" prejoin screen — both the old and new
            // config keys, since meet.jit.si has changed this over versions.
            prejoinPageEnabled: false,
            prejoinConfig: { enabled: false },
            disableDeepLinking: true,
          },
        });
        apiRef.current = api;
        setLoaded(true);
        api.on('readyToClose', () => onEndRef.current());
        api.on('videoConferenceLeft', () => onEndRef.current());
      })
      .catch(() => onEndRef.current());

    return () => {
      cancelled = true;
      try {
        apiRef.current?.dispose();
      } catch {
        /* ignore */
      }
      apiRef.current = null;
    };
  }, [isJitsi, roomUrl, userName]);

  // --- Generic hosted-iframe path (legacy non-Jitsi providers) ---
  const iframeSrc = useMemo(() => {
    if (isJitsi || isBrowserOnly || !roomUrl) return '';
    try {
      const url = new URL(roomUrl);
      if (userName) url.searchParams.set('userName', userName);
      return url.toString();
    } catch {
      return roomUrl;
    }
  }, [isBrowserOnly, isJitsi, roomUrl, userName]);

  if (!roomUrl) return null;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-black">
      <div className="flex items-center justify-between bg-neutral-900 px-4 py-2 text-white/90">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Video className="h-4 w-4" /> Video Consultation
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-8 rounded-full"
            onClick={() => window.open(roomUrl, '_blank', 'noopener,noreferrer')}
            title="Open the consultation in a new browser tab"
          >
            <ExternalLink className="mr-1 h-4 w-4" /> Open in browser
          </Button>
          <Button variant="destructive" size="sm" className="h-8 rounded-full" onClick={onEnd}>
            <PhoneOff className="mr-1 h-4 w-4" /> Leave
          </Button>
        </div>
      </div>

      <div className="relative flex-1">
        {!loaded && !isBrowserOnly && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Connecting to the consultation…</p>
          </div>
        )}

        {isBrowserOnly ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-white">
            <div className="max-w-md text-center">
              <ShieldCheck className="mx-auto mb-5 h-12 w-12 text-emerald-400" />
              <h2 className="text-2xl font-semibold">Open secure consultation</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-300">
                Camera and microphone access will open in a dedicated browser tab.
              </p>
              <Button
                className="mt-6 h-11 rounded-md bg-white px-5 text-neutral-950 hover:bg-neutral-200"
                onClick={() => window.open(roomUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="mr-2 h-4 w-4" /> Open Consultation
              </Button>
            </div>
          </div>
        ) : isJitsi ? (
          <div ref={containerRef} className="absolute inset-0 h-full w-full" />
        ) : (
          <iframe
            title="Video consultation"
            src={iframeSrc}
            onLoad={() => setLoaded(true)}
            allow="camera; microphone; fullscreen; display-capture; autoplay; speaker-selection"
            className="absolute inset-0 h-full w-full border-0"
          />
        )}
      </div>
    </div>
  );
}

export default VideoCall;
