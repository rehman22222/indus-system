import mongoose from 'mongoose';
import { env } from './env.js';

const DEFAULT_DB_NAME = 'doctorappointment';

export async function connectMongoDB() {
    mongoose.set('strictQuery', true);
    mongoose.set('autoIndex', env.MONGODB_AUTO_INDEX);

    await mongoose.connect(env.MONGODB_URI, {
        dbName: env.MONGODB_DB_NAME || DEFAULT_DB_NAME,
        serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
        maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
        minPoolSize: env.MONGODB_MIN_POOL_SIZE,
        retryWrites: true,
    });

    console.log(`MongoDB connected: ${mongoose.connection.name}`);
    return mongoose.connection;
}

export async function disconnectMongoDB() {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
}

export function mongoHealth() {
    return {
        readyState: mongoose.connection.readyState,
        state:
            ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] ||
            'unknown',
        database: mongoose.connection.name || null,
        host: mongoose.connection.host || null,
    };
}

export default mongoose;
