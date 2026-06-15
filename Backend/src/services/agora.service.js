import pkg from 'agora-token';

import { env } from '../config/env.js';

const { RtcTokenBuilder, RtcRole } = pkg;
import { AppError } from '../middleware/errorHandler.js';

/** Whether the public Agora RTC App ID is present. */
export function isAgoraConfigured() {
    return Boolean(env.AGORA_APP_ID);
}

/** Deterministic, Agora-safe channel name for an appointment. */
export function agoraChannelFor(appointmentId) {
    return `indus-appointment-${appointmentId}`;
}

/** Stable numeric uid per role so we can tell participants apart. */
export function uidForRole(role) {
    if (role === 'doctor') return 1;
    if (role === 'patient') return 2;
    return 3; // staff/observer
}

/**
 * Mint a short-lived Agora RTC token for a channel + uid. The App Certificate
 * never leaves the server; only the resulting token + public App ID are sent
 * to clients.
 */
export function generateRtcToken({ channel, uid = 0, ttl = env.AGORA_TOKEN_TTL_SECONDS }) {
    if (!isAgoraConfigured()) {
        throw new AppError('Agora App ID is not configured', 500);
    }
    if (!env.AGORA_APP_CERTIFICATE) {
        return {
            appId: env.AGORA_APP_ID,
            channel,
            uid,
            token: null,
            expiresAt: null,
        };
    }
    const now = Math.floor(Date.now() / 1000);
    const expireAt = now + Math.max(60, Number(ttl) || 3600);
    const token = RtcTokenBuilder.buildTokenWithUid(
        env.AGORA_APP_ID,
        env.AGORA_APP_CERTIFICATE,
        channel,
        uid,
        RtcRole.PUBLISHER,
        expireAt,
        expireAt,
    );
    return { appId: env.AGORA_APP_ID, channel, uid, token, expiresAt: expireAt };
}
