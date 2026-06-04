// API Service for authentication and general requests
import api from './core-api';

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
}

export default ApiService;
