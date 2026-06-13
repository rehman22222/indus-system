import { env } from '@/config/env';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

type RequestOptions = RequestInit & {
  auth?: boolean;
};

const REQUEST_TIMEOUT_MS = 15000;

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');

  if (options.auth !== false && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  // Fail fast with a clear, actionable error instead of spinning forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, { ...options, headers, signal: controller.signal });
  } catch (error) {
    const aborted = (error as Error)?.name === 'AbortError';
    throw new Error(
      aborted
        ? `Can't reach the server at ${env.apiBaseUrl}. Make sure the phone and PC are on the same Wi-Fi and the backend port (5000) is allowed through the firewall.`
        : `Network error reaching ${env.apiBaseUrl}: ${(error as Error)?.message || 'unknown'}`,
    );
  } finally {
    clearTimeout(timer);
  }

  const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
  if (!response.ok) {
    throw new Error(body?.message || body?.error || `Request failed with ${response.status}`);
  }

  return body as T;
}

export function buildQuery(params: Record<string, unknown>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }
  const value = query.toString();
  return value ? `?${value}` : '';
}
