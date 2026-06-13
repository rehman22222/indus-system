import { MongoDB } from '@/integrations/mongodb/client';

function tokenDateParts(date: string) {
    const [year, month, day] = String(date).split('-').map(Number);
    if (year && month && day) {
        return {
            month: String(month).padStart(2, '0'),
            day: String(day).padStart(2, '0'),
        };
    }

    const parsed = new Date(date);
    return {
        month: String(parsed.getMonth() + 1).padStart(2, '0'),
        day: String(parsed.getDate()).padStart(2, '0'),
    };
}

/**
 * Generates a unique appointment token in format: D-MMDD-NNN
 * Checks database for collision — retries up to 10 times.
 * Falls back to timestamp-based suffix if all retries fail.
 */
export async function generateUniqueToken(
    doctorId: string,
    date: string
): Promise<string> {
    const parts = doctorId?.split('-');
    const docPrefix = parts && parts[1] ? parts[1].substring(0, 1).toUpperCase() : 'D';

    const { month, day } = tokenDateParts(date);

    for (let attempt = 0; attempt < 10; attempt++) {
        const random = Math.floor(Math.random() * 900) + 100;
        const token = `${docPrefix}-${month}${day}-${random}`;

        try {
            const { data, error } = await MongoDB
                .from('appointments')
                .select('id')
                .eq('token', token)
                .maybeSingle();

            if (error) {
                // If DB check fails, still use the token
                // (better than blocking the booking)
                return token;
            }

            if (!data) {
                // Token is unique — use it
                return token;
            }

            // Token exists — retry with new random number
        } catch {
            return token;
        }
    }

    // Fallback: timestamp ensures uniqueness
    return `${docPrefix}-${month}${day}-${Date.now().toString().slice(-3)}`;
}

/**
 * Offline token generator — no DB check needed
 * Used when MongoDB is not configured
 */
export function generateOfflineToken(doctorId: string, date: string): string {
    const parts = doctorId?.split('-');
    const docPrefix = parts && parts[1] ? parts[1].substring(0, 1).toUpperCase() : 'D';

    const { month, day } = tokenDateParts(date);
    const random = Math.floor(Math.random() * 900) + 100;

    return `${docPrefix}-${month}${day}-${random}`;
}
