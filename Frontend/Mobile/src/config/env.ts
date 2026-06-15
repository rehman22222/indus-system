import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra || {}) as Record<string, string | undefined>;

/**
 * Resolve the backend base URL.
 *
 * In Expo Go / dev the backend runs on the SAME machine as Metro, so we derive
 * its host from Metro's `hostUri` (e.g. "192.168.1.45:8081" -> the backend at
 * "http://192.168.1.45:5000"). This means the app automatically follows the dev
 * machine's IP — you never have to edit EXPO_PUBLIC_API_BASE_URL when the IP
 * changes, and it can't accidentally fall back to "localhost" (which on a phone
 * is the phone itself, causing a hang).
 *
 * A real remote URL (https) always wins — that's what a production build uses.
 */
function resolveApiBaseUrl(): string {
  const explicit = (process.env.EXPO_PUBLIC_API_BASE_URL || extra.apiBaseUrl || '').trim();

  // Production / tunnel: an https URL is authoritative.
  if (explicit && /^https:\/\//i.test(explicit)) return explicit;

  // Dev: follow the host the device used to reach Metro.
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost ||
    (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } }).manifest2?.extra?.expoGo?.debuggerHost ||
    '';
  const host = String(hostUri).split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:5000`;
  }

  return explicit || 'http://localhost:5000';
}

function resolveWebBaseUrl(apiBaseUrl: string): string {
  const explicit = (process.env.EXPO_PUBLIC_WEB_BASE_URL || extra.webBaseUrl || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');

  // In local development Vite and the API share the same machine.
  if (/^http:\/\/[^/]+:5000$/i.test(apiBaseUrl)) {
    return apiBaseUrl.replace(/:5000$/i, ':5173');
  }

  // Production deployments can serve the portal and API from one origin.
  return apiBaseUrl.replace(/\/api\/?$/i, '');
}

const apiBaseUrl = resolveApiBaseUrl();

export const env = {
  apiBaseUrl,
  webBaseUrl: resolveWebBaseUrl(apiBaseUrl),
  appName: process.env.EXPO_PUBLIC_APP_NAME || 'Indus Hospital',
};
