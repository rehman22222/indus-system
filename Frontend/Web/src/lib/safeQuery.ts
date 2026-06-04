import { isSupabaseConfigured, markSchemaMissing } from '@/integrations/supabase/client';

/**
 * Shape of the typical Supabase response: `{ data, error, status, statusText }`.
 * `status` is the HTTP status returned by PostgREST. PostgrestError objects
 * carry a `code` field we use to distinguish "table missing" (42P01) from
 * other errors.
 */
type SupabaseLikeResponse<T> = {
    data: T | null;
    error: unknown;
    status?: number;
    statusText?: string;
};

const NETWORK_ERROR_PATTERNS = [
    'ERR_NAME_NOT_RESOLVED',
    'Failed to fetch',
    'SUPABASE_NOT_CONFIGURED',
    'SUPABASE_UNREACHABLE',
    'SUPABASE_SCHEMA_MISSING',
    'NetworkError',
    'net::',
];

function isNetworkError(msg: string): boolean {
    return NETWORK_ERROR_PATTERNS.some((p) => msg.includes(p));
}

/**
 * Returns true when the response indicates the queried relation does not
 * exist. PostgREST surfaces this as HTTP 404 with PostgrestError code
 * "42P01" / message "relation \"public.<table>\" does not exist".
 */
function isMissingRelation(result: SupabaseLikeResponse<unknown>): boolean {
    if (result.status === 404) return true;
    const err = result.error as { code?: string; message?: string } | null;
    if (!err) return false;
    // 42P01 — Postgres "relation does not exist"
    // PGRST205 — PostgREST "Could not find the table … in the schema cache"
    // PGRST200 — PostgREST "Could not find a relationship between … in the schema cache"
    //            (FK lookup failure, returned as HTTP 400; same root cause: schema missing)
    if (err.code === '42P01' || err.code === 'PGRST205' || err.code === 'PGRST200') return true;
    if (typeof err.message === 'string') {
        if (/relation .* does not exist/i.test(err.message)) return true;
        if (/could not find (the table|a relationship)/i.test(err.message)) return true;
    }
    return false;
}

/**
 * One-shot warning per session per table — once we've logged that a
 * particular table is missing, every subsequent caller for the same
 * table stays silent.
 */
const warnedMissingTables = new Set<string>();

function warnMissingTableOnce(result: SupabaseLikeResponse<unknown>): void {
    const err = result.error as { message?: string } | null;
    const match = err?.message?.match(/relation "?([^"]+)"? does not exist/i);
    const tableName = match?.[1] ?? `<status ${result.status ?? '?'}>`;
    if (warnedMissingTables.has(tableName)) return;
    warnedMissingTables.add(tableName);
    // eslint-disable-next-line no-console
    console.warn(
        `[safeQuery] Supabase responded with 404 for "${tableName}" — schema not deployed yet. ` +
        'Returning fallback data. Apply the migration in supabase/migrations/ and reload to retry.'
    );
}

/**
 * Wraps any Supabase query with proper error handling and fallback.
 * Returns fallback data when offline, when the schema is missing, or
 * on any other error. Never throws.
 */
export async function safeQuery<T>(
    queryFn: () => PromiseLike<SupabaseLikeResponse<T>>,
    fallback: T
): Promise<T> {
    if (!isSupabaseConfigured) {
        return fallback;
    }

    try {
        const result = await queryFn();

        if (result.error) {
            // Missing-relation 404 is an expected state on a fresh project.
            // Emit one explicit warning per table per session, then fall
            // back. Other PostgrestErrors fall back silently.
            if (isMissingRelation(result)) {
                warnMissingTableOnce(result);
                markSchemaMissing();
                return fallback;
            }

            const msg =
                result.error instanceof Error
                    ? result.error.message
                    : String(result.error);

            // Network-class errors are silent — already logged once by the
            // client wrapper; no point repeating per-hook.
            if (isNetworkError(msg)) {
                return fallback;
            }

            // Anything else: silent fallback. Returning data over throwing
            // keeps the UI rendered even when something unexpected goes wrong.
            return fallback;
        }

        return result.data ?? fallback;
    } catch {
        return fallback;
    }
}

/**
 * Wraps Supabase query with `{ data, error }` return pattern.
 * Use this when you need to distinguish between offline and other errors.
 */
export async function safeQueryWithError<T>(
    queryFn: () => PromiseLike<SupabaseLikeResponse<T>>
): Promise<{ data: T | null; error: string | null }> {
    if (!isSupabaseConfigured) {
        return { data: null, error: 'OFFLINE' };
    }

    try {
        const result = await queryFn();

        if (result.error) {
            if (isMissingRelation(result)) {
                warnMissingTableOnce(result);
                return { data: null, error: 'SCHEMA_MISSING' };
            }

            const msg =
                result.error instanceof Error
                    ? result.error.message
                    : String(result.error);

            if (isNetworkError(msg)) {
                return { data: null, error: 'OFFLINE' };
            }

            return { data: null, error: msg };
        }

        return { data: result.data, error: null };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isNetworkError(msg)) {
            return { data: null, error: 'OFFLINE' };
        }
        return { data: null, error: msg };
    }
}
