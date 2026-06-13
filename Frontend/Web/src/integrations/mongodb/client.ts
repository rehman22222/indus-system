import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

type Filter = { op: string; column: string; value: unknown };
type Order = { column: string; ascending?: boolean };
type QueryResult<T = any> = { data: T | null; error: any | null };

export type User = {
  id: string;
  email?: string;
  role?: string;
  user_metadata?: any;
};

export type Session = {
  access_token?: string;
  user?: User;
};

const PENDING_SIGNUP_KEY = 'auth.pendingSignup';
const PENDING_RECOVERY_KEY = 'auth.pendingRecovery';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000';

const QUEUE_EVENTS = [
  'queue.updated',
  'patient.checked_in',
  'patient.called',
  'consultation.started',
  'consultation.completed',
  'appointment.cancelled',
  'notification:new',
  'documents.updated',
];

let realtimeSocket: Socket | null = null;

function getRealtimeSocket() {
  if (!realtimeSocket) {
    realtimeSocket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      auth: { token: getAuthToken() },
    });
  }
  return realtimeSocket;
}

/**
 * Subscribe to a raw server-emitted Socket.IO event (e.g. `call:declined`)
 * on the current user's private room. Returns an unsubscribe function.
 */
export function onServerEvent(event: string, handler: (payload: any) => void) {
  const socket = getRealtimeSocket();
  (socket as any).auth = { token: getAuthToken() };
  if (!socket.connected) socket.connect();
  socket.on(event, handler);
  return () => {
    socket.off(event, handler);
  };
}

export type RealtimeChannel = {
  on: (...args: unknown[]) => RealtimeChannel;
  subscribe: (callback?: (status: string) => void) => RealtimeChannel;
  send: (payload: unknown) => Promise<string>;
  track: (payload: unknown) => Promise<string>;
  untrack: () => Promise<string>;
  presenceState: () => Record<string, unknown>;
  unsubscribe: () => Promise<string>;
};

function getAuthToken(): string | null {
  try {
    return localStorage.getItem('auth_token');
  } catch {
    return null;
  }
}

function storeAuthSession(token: string, user: User) {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('user', JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('mongo-auth-change'));
}

function clearAuthSession() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
  window.dispatchEvent(new CustomEvent('mongo-auth-change'));
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Array.isArray(data.errors) ? data.errors.join(', ') : '';
    throw new Error(details || data.message || data.error || `Request failed with ${response.status}`);
  }
  return data as T;
}

function buildQueryString(params: Record<string, unknown>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value) || typeof value === 'object') {
      search.set(key, JSON.stringify(value));
    } else {
      search.set(key, String(value));
    }
  });
  const value = search.toString();
  return value ? `?${value}` : '';
}

const DOMAIN_ROUTES: Record<string, string> = {
  appointments: '/api/v1/appointments',
  doctors: '/api/v1/doctors',
  patients: '/api/v1/patients',
  departments: '/api/v1/departments',
  appointment_slots: '/api/v1/slots',
  slots: '/api/v1/slots',
  queue: '/api/v1/queue',
  prescriptions: '/api/v1/prescriptions',
  notifications: '/api/v1/notifications',
  audit_logs: '/api/v1/admin/audit-logs',
  system_settings: '/api/v1/management/system-settings',
};

const DOMAIN_INSERTS = new Set([
  'appointments',
  'doctors',
  'patients',
  'departments',
  'appointment_slots',
  'slots',
  'prescriptions',
  'notifications',
  'audit_logs',
]);

const DOMAIN_UPDATES = new Set([
  'appointments',
  'doctors',
  'patients',
  'appointment_slots',
  'slots',
  'queue',
  'prescriptions',
  'notifications',
]);

const DOMAIN_DELETES = new Set(['appointments']);

function isIdFilter(filter: Filter) {
  return filter.op === 'eq' && (filter.column === 'id' || filter.column === '_id');
}

class MongoQueryBuilder<T = any> implements PromiseLike<QueryResult<T>> {
  private operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private filters: Filter[] = [];
  private orFilters: string[] = [];
  private orders: Order[] = [];
  private payload: unknown;
  private rowLimit?: number;
  private offset?: number;
  private singleMode: 'single' | 'maybeSingle' | null = null;
  private onConflict?: string;
  private columns?: string;

  constructor(private readonly collection: string) {}

  select(columns?: string): this {
    this.columns = columns;
    return this;
  }

  insert(data: unknown): this {
    this.operation = 'insert';
    this.payload = data;
    return this;
  }

  update(data: unknown): this {
    this.operation = 'update';
    this.payload = data;
    return this;
  }

  upsert(data: unknown, options?: { onConflict?: string }): this {
    this.operation = 'upsert';
    this.payload = data;
    this.onConflict = options?.onConflict;
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ op: 'eq', column, value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ op: 'neq', column, value });
    return this;
  }

  gt(column: string, value: unknown): this {
    this.filters.push({ op: 'gt', column, value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ op: 'gte', column, value });
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push({ op: 'lt', column, value });
    return this;
  }

  lte(column: string, value: unknown): this {
    this.filters.push({ op: 'lte', column, value });
    return this;
  }

  in(column: string, value: unknown[]): this {
    this.filters.push({ op: 'in', column, value });
    return this;
  }

  ilike(column: string, value: string): this {
    this.filters.push({ op: 'ilike', column, value });
    return this;
  }

  or(expression: string): this {
    this.orFilters.push(expression);
    return this;
  }

  order(column: string, options?: { ascending?: boolean; [key: string]: unknown }): this {
    this.orders.push({ column, ascending: options?.ascending });
    return this;
  }

  limit(count: number): this {
    this.rowLimit = count;
    return this;
  }

  range(from: number, to: number): this {
    this.offset = from;
    this.rowLimit = Math.max(to - from + 1, 0);
    return this;
  }

  single(): this {
    this.singleMode = 'single';
    this.rowLimit = 1;
    return this;
  }

  maybeSingle(): this {
    this.singleMode = 'maybeSingle';
    this.rowLimit = 1;
    return this;
  }

  returns(): this {
    return this;
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult<T>> {
    try {
      const domainRoute = DOMAIN_ROUTES[this.collection];
      const idFilter = this.filters.find(isIdFilter);
      const query = buildQueryString({
        filters: this.filters,
        orFilters: this.orFilters,
        orders: this.orders,
        limit: this.rowLimit,
        offset: this.offset,
        fields: this.columns && this.columns !== '*' ? this.columns : undefined,
      });

      let response: { data: unknown };
      if (domainRoute && this.operation === 'select') {
        response = await apiRequest(`${domainRoute}${query}`);
      } else if (domainRoute && this.operation === 'insert' && DOMAIN_INSERTS.has(this.collection)) {
        response = await apiRequest(domainRoute, {
          method: 'POST',
          body: JSON.stringify(this.payload),
        });
      } else if (domainRoute && this.operation === 'upsert' && this.collection === 'system_settings') {
        response = await apiRequest(domainRoute, {
          method: 'POST',
          body: JSON.stringify(this.payload),
        });
      } else if (domainRoute && this.operation === 'update' && idFilter && DOMAIN_UPDATES.has(this.collection)) {
        response = await apiRequest(`${domainRoute}/${idFilter.value}`, {
          method: 'PATCH',
          body: JSON.stringify(this.payload),
        });
      } else if (domainRoute && this.operation === 'delete' && idFilter && DOMAIN_DELETES.has(this.collection)) {
        response = await apiRequest(`${domainRoute}/${idFilter.value}`, {
          method: 'DELETE',
        });
      } else if (this.operation === 'insert') {
        response = await apiRequest(`/api/v1/data/${this.collection}`, {
          method: 'POST',
          body: JSON.stringify({ data: this.payload }),
        });
      } else if (this.operation === 'update') {
        response = await apiRequest(`/api/v1/data/${this.collection}${query}`, {
          method: 'PATCH',
          body: JSON.stringify({ data: this.payload }),
        });
      } else if (this.operation === 'upsert') {
        response = await apiRequest(`/api/v1/data/${this.collection}`, {
          method: 'PUT',
          body: JSON.stringify({ data: this.payload, onConflict: this.onConflict }),
        });
      } else if (this.operation === 'delete') {
        response = await apiRequest(`/api/v1/data/${this.collection}${query}`, {
          method: 'DELETE',
        });
      } else {
        response = await apiRequest(`/api/v1/data/${this.collection}${query}`);
      }

      let data = response.data;
      if (this.singleMode) {
        data = Array.isArray(data) ? (data[0] ?? null) : data ?? null;
      }

      return { data: data as T, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }
}

function createChannel(name = ''): RealtimeChannel {
  const handlers: Array<{ event: string; callback: (payload: unknown) => void }> = [];
  const boundHandlers: Array<{ event: string; fn: (payload: unknown) => void }> = [];
  let socket: Socket | null = null;

  const channel: RealtimeChannel = {
    on: (...args: unknown[]) => {
      const callback = args.find((arg) => typeof arg === 'function') as ((payload: unknown) => void) | undefined;
      if (!callback) return channel;

      const eventType = String(args[0] || '*');
      const options = typeof args[1] === 'object' && args[1] ? (args[1] as Record<string, any>) : {};
      const event =
        eventType === 'postgres_changes'
          ? '*'
          : eventType === 'broadcast' && options.event
            ? String(options.event)
            : eventType;

      handlers.push({ event, callback });
      return channel;
    },
    subscribe: (callback) => {
      setTimeout(() => callback?.('SUBSCRIBED'), 0);
      socket = getRealtimeSocket();
      (socket as any).auth = { token: getAuthToken() };
      if (!socket.connected) socket.connect();
      socket.emit('queue.join', { channel: name });

      for (const handler of handlers) {
        const events = handler.event === '*' ? QUEUE_EVENTS : [handler.event];
        for (const event of events) {
          const fn = (payload: unknown) => handler.callback({ event, payload, new: payload });
          socket.on(event, fn);
          boundHandlers.push({ event, fn });
        }
      }

      return channel;
    },
    send: async () => 'ok',
    track: async () => 'ok',
    untrack: async () => 'ok',
    presenceState: () => ({}),
    unsubscribe: async () => {
      if (socket) {
        socket.emit('queue.leave', { channel: name });
        for (const handler of boundHandlers) {
          socket.off(handler.event, handler.fn);
        }
      }
      boundHandlers.length = 0;
      return 'ok';
    },
  };
  return channel;
}

export const mongodb: any = {
  from: <T = any>(collection: string) => new MongoQueryBuilder<T>(collection),
  rpc: async (name: string, args?: unknown) => {
    try {
      const data = await apiRequest(`/api/v1/data/rpc/${name}`, {
        method: 'POST',
        body: JSON.stringify(args || {}),
      });
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },
  channel: (name?: string) => createChannel(name),
  removeChannel: async (channel?: RealtimeChannel) => {
    await channel?.unsubscribe();
    return 'ok';
  },
  functions: {
    invoke: async (_name: string, _payload?: unknown) => ({ data: null, error: null }),
  },
  auth: {
    onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
      const handler = () => {
        const token = getAuthToken();
        const rawUser = localStorage.getItem('user');
        const user = rawUser ? JSON.parse(rawUser) : null;
        callback(token && user ? 'SIGNED_IN' : 'SIGNED_OUT', token && user ? { access_token: token, user } : null);
      };
      window.addEventListener('mongo-auth-change', handler);
      setTimeout(handler, 0);
      return {
        data: {
          subscription: {
            unsubscribe: () => window.removeEventListener('mongo-auth-change', handler),
          },
        },
      };
    },
    getSession: async () => ({
      data: {
        session: (() => {
          const token = getAuthToken();
          const rawUser = localStorage.getItem('user');
          const user = rawUser ? JSON.parse(rawUser) : null;
          return token && user ? { access_token: token, user } : null;
        })(),
      },
      error: null,
    }),
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      try {
        const data = await apiRequest<{ token: string; user: User; success: boolean }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });
        storeAuthSession(data.token, data.user);
        return {
          data: { user: data.user, session: { access_token: data.token, user: data.user } },
          error: null,
        };
      } catch (error) {
        return { data: { user: null, session: null }, error: error as Error };
      }
    },
    signUp: async ({
      email,
      password,
      options,
    }: {
      email: string;
      password: string;
      options?: { data?: Record<string, unknown> };
    }) => {
      try {
        localStorage.setItem(
          PENDING_SIGNUP_KEY,
          JSON.stringify({ email, password, data: options?.data || {} }),
        );
        await apiRequest('/api/auth/send-otp', {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            name: String(options?.data?.full_name || options?.data?.name || 'User'),
          }),
        });
        return { data: { user: null, session: null }, error: null };
      } catch (error) {
        return { data: { user: null, session: null }, error: error as Error };
      }
    },
    verifyOtp: async ({ email, token, type }: { email: string; token: string; type?: string }) => {
      try {
        if (type === 'recovery') {
          localStorage.setItem(PENDING_RECOVERY_KEY, JSON.stringify({ email, token }));
          return { data: { user: null, session: null }, error: null };
        }

        const pending = JSON.parse(localStorage.getItem(PENDING_SIGNUP_KEY) || '{}');
        const profile = pending.data || {};
        const data = await apiRequest<{ token: string; user: User; success: boolean }>('/api/auth/verify-otp', {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            code: token,
            password: pending.password,
            name: profile.full_name || profile.name,
            phone: profile.phone,
            cnic: profile.cnic,
            age: profile.age,
            gender: profile.gender,
          }),
        });
        localStorage.removeItem(PENDING_SIGNUP_KEY);
        storeAuthSession(data.token, data.user);
        return {
          data: { user: data.user, session: { access_token: data.token, user: data.user } },
          error: null,
        };
      } catch (error) {
        return { data: { user: null, session: null }, error: error as Error };
      }
    },
    resend: async ({ email }: { email: string; [key: string]: unknown }) => {
      try {
        await apiRequest('/api/auth/resend-otp', {
          method: 'POST',
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
        return { data: {}, error: null };
      } catch (error) {
        return { data: null, error: error as Error };
      }
    },
    resetPasswordForEmail: async (email: string, _options?: unknown) => {
      try {
        await apiRequest('/api/auth/send-otp', {
          method: 'POST',
          body: JSON.stringify({ email: email.trim().toLowerCase(), name: 'User' }),
        });
        return { data: {}, error: null };
      } catch (error) {
        return { data: null, error: error as Error };
      }
    },
    updateUser: async ({ password }: { password: string }) => {
      try {
        const pending = JSON.parse(localStorage.getItem(PENDING_RECOVERY_KEY) || '{}');
        if (!pending.email || !pending.token) throw new Error('Recovery code is missing.');
        await apiRequest('/api/auth/verify-otp', {
          method: 'POST',
          body: JSON.stringify({
            email: pending.email,
            code: pending.token,
            password,
          }),
        });
        localStorage.removeItem(PENDING_RECOVERY_KEY);
        return { data: {}, error: null };
      } catch (error) {
        return { data: null, error: error as Error };
      }
    },
    signOut: async () => {
      clearAuthSession();
      return { error: null };
    },
  },
};

export const MongoDB = mongodb;

export const isMongoConfigured = true;
export const isMongoReachable = () => true;
export const isDatabaseConfigured = true;
export const isSchemaDeployed = () => true;
export function markSchemaMissing(): void {}
export function resetMongoReachability(): void {}
