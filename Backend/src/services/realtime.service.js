import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

let io;
let redisAdapterReady = false;

export async function initRealtime(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: env.CORS_ORIGINS,
            credentials: true,
        },
    });

    // Identify the socket from its JWT (optional) so we can target a specific
    // user — used for direct signalling like incoming video calls.
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (token) {
                const payload = jwt.verify(token, env.JWT_SECRET);
                socket.data.userId = payload.userId || payload.sub;
                socket.data.role = payload.role;
                if (payload.type === 'video-call' && payload.appointmentId) {
                    socket.data.videoAppointmentId = String(payload.appointmentId);
                    socket.data.videoRole = String(payload.role || 'participant');
                }
            }
        } catch {
            /* anonymous socket — still allowed for public queue events */
        }
        next();
    });

    const resolveRoom = (payload = {}) => {
        const channel = String(payload.channel || '');
        const queueMatch = channel.match(/^queue:([^:]+)/);
        const doctorId = payload.doctor_id || queueMatch?.[1];
        return doctorId ? `doctor:${doctorId}` : 'queue';
    };

    io.on('connection', (socket) => {
        // Join a private per-user room so the server can ring this exact user.
        if (socket.data.userId) socket.join(`user:${socket.data.userId}`);

        socket.on('queue.join', (payload = {}) => {
            socket.join(resolveRoom(payload));
        });

        socket.on('queue.leave', (payload = {}) => {
            socket.leave(resolveRoom(payload));
        });

        socket.on('video.join', async (payload = {}) => {
            const appointmentId = String(payload.appointmentId || '');
            if (!appointmentId || appointmentId !== socket.data.videoAppointmentId) {
                socket.emit('video.error', { message: 'Invalid or expired consultation link' });
                return;
            }

            const room = `video:${appointmentId}`;
            const participants = (await io.in(room).fetchSockets()).filter((participant) => participant.id !== socket.id);
            if (participants.length >= 2) {
                socket.emit('video.error', { message: 'This consultation already has two participants' });
                return;
            }

            await socket.join(room);
            for (const participant of participants) {
                socket.emit('video.peer-joined', { role: participant.data.videoRole || 'participant' });
            }
            socket.to(room).emit('video.peer-joined', { role: socket.data.videoRole || 'participant' });
        });

        socket.on('video.signal', (payload = {}) => {
            const appointmentId = String(payload.appointmentId || '');
            if (!payload.signal || appointmentId !== socket.data.videoAppointmentId) return;
            socket.to(`video:${appointmentId}`).emit('video.signal', { signal: payload.signal });
        });

        socket.on('video.leave', () => {
            const appointmentId = socket.data.videoAppointmentId;
            if (!appointmentId) return;
            const room = `video:${appointmentId}`;
            socket.to(room).emit('video.peer-left');
            socket.leave(room);
        });

        socket.on('video.end', (_payload = {}, acknowledge) => {
            const appointmentId = socket.data.videoAppointmentId;
            if (!appointmentId) {
                if (typeof acknowledge === 'function') acknowledge({ ok: false });
                return;
            }
            const room = `video:${appointmentId}`;

            // A deliberate hang-up ends the consultation for every participant.
            // Browser/tab disconnects still use video.peer-left so a participant
            // can recover from an accidental refresh without ending the session.
            io.to(room).emit('video.ended', {
                appointmentId,
                endedBy: socket.data.videoRole || 'participant',
            });
            io.in(room).socketsLeave(room);
            if (typeof acknowledge === 'function') acknowledge({ ok: true });
        });

        socket.on('disconnecting', () => {
            const appointmentId = socket.data.videoAppointmentId;
            if (appointmentId && socket.rooms.has(`video:${appointmentId}`)) {
                socket.to(`video:${appointmentId}`).emit('video.peer-left');
            }
        });
    });

    if (env.SOCKET_IO_REDIS_URL) {
        try {
            const pubClient = createClient({ url: env.SOCKET_IO_REDIS_URL });
            const subClient = pubClient.duplicate();
            // Error listeners are required so a reset TLS socket doesn't bubble
            // up as an uncaught exception and crash the server.
            pubClient.on('error', (err) => console.warn('Socket.IO Redis pub error:', err.message));
            subClient.on('error', (err) => console.warn('Socket.IO Redis sub error:', err.message));
            await Promise.all([pubClient.connect(), subClient.connect()]);
            io.adapter(createAdapter(pubClient, subClient));
            redisAdapterReady = true;
            console.log('Socket.IO Redis adapter connected');
        } catch (error) {
            redisAdapterReady = false;
            console.warn('Socket.IO Redis adapter disabled:', error.message);
        }
    }

    return io;
}

export function realtimeStatus() {
    return {
        ready: Boolean(io),
        adapter: redisAdapterReady ? 'redis' : 'in-memory',
        redisAdapterReady,
    };
}

export function emitQueueEvent(event, payload = {}) {
    if (!io) return;

    io.to('queue').emit(event, payload);
    if (payload.doctor_id) io.to(`doctor:${payload.doctor_id}`).emit(event, payload);
}

/** Send an event directly to a specific user's devices/tabs. */
export function emitToUser(userId, event, payload = {}) {
    if (!io || !userId) return;
    io.to(`user:${userId}`).emit(event, payload);
}

export function getRealtime() {
    return io;
}
