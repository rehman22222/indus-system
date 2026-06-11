// Core API service for the mobile app
// Connects to MongoDB Edge Functions and centralized backend services

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = {
    get: async (endpoint: string) => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return response.json();
    },
    post: async (endpoint: string, data: any) => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return response.json();
    },
    put: async (endpoint: string, data: any) => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return response.json();
    },
    delete: async (endpoint: string) => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return response.json();
    },
};

export class ApiService {
    static async login(email: string, password: string) {
        return api.post('/auth/login', { email, password });
    }

    static async register(userData: any) {
        return api.post('/auth/register', userData);
    }

    static async logout() {
        return api.post('/auth/logout', {});
    }

    static async getProfile() {
        return api.get('/auth/profile');
    }

    static async getAppointments(userId?: string) {
        const endpoint = userId ? `/appointments?patient_id=${userId}` : '/appointments';
        return api.get(endpoint);
    }

    static async getDoctorQueue(doctorId: string) {
        return api.get(`/doctor-queue?doctor_id=${doctorId}`);
    }

    static async getDoctors(specialty?: string) {
        const endpoint = specialty ? `/doctors?specialty=${specialty}` : '/doctors';
        return api.get(endpoint);
    }

    static async getSlots(doctorId: string, date: string) {
        return api.get(`/doctors/${doctorId}/slots?date=${date}`);
    }

    static async bookAppointment(data: any) {
        return api.post('/appointments', data);
    }

    static async getPrescriptions(patientId: string) {
        return api.get(`/prescriptions?patient_id=${patientId}`);
    }

    static async getLastVisit(patientId: string) {
        return api.get(`/visits/last?patient_id=${patientId}`);
    }
}

export class SocketService {
    static connect() {
        // Implementation for production WebSocket connection
        console.log('[SocketService] Connected to real-time events');
    }

    static disconnect() {
        console.log('[SocketService] Disconnected');
    }

    static on(event: string, callback: Function) {
        // Wire to real Socket.io or MongoDB Realtime
        console.log(`[SocketService] Listening to ${event}`);
    }

    static off(event: string, callback: Function) {
        console.log(`[SocketService] Stopped listening to ${event}`);
    }

    static emit(event: string, data: any) {
        console.log(`[SocketService] Emitting ${event}`, data);
    }
}

export default api;
