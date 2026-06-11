import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
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

    const resolveRoom = (payload = {}) => {
        const channel = String(payload.channel || '');
        const queueMatch = channel.match(/^queue:([^:]+)/);
        const doctorId = payload.doctor_id || queueMatch?.[1];
        return doctorId ? `doctor:${doctorId}` : 'queue';
    };

    io.on('connection', (socket) => {
        socket.on('queue.join', (payload = {}) => {
            socket.join(resolveRoom(payload));
        });

        socket.on('queue.leave', (payload = {}) => {
            socket.leave(resolveRoom(payload));
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

export function getRealtime() {
    return io;
}
