import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthUser, UserRole } from '../types/auth.types';

const STORAGE_KEY = 'indus_user';
const TOKEN_KEY = 'indus_token';

interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    setUser: (user: AuthUser | null) => void;
    setToken: (token: string | null) => void;
    logout: () => void;
    isAuthenticated: boolean;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUserState] = useState<AuthUser | null>(null);
    const [token, setTokenState] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        try {
            const storedUser = localStorage.getItem(STORAGE_KEY);
            const storedToken = localStorage.getItem(TOKEN_KEY);
            if (storedUser) setUserState(JSON.parse(storedUser));
            if (storedToken) setTokenState(storedToken);
        } catch (_) { }
        setIsLoading(false);
    }, []);

    const setUser = (u: AuthUser | null) => {
        setUserState(u);
        if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
        else localStorage.removeItem(STORAGE_KEY);
    };

    const setToken = (t: string | null) => {
        setTokenState(t);
        if (t) localStorage.setItem(TOKEN_KEY, t);
        else localStorage.removeItem(TOKEN_KEY);
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        navigate('/login', { replace: true });
    };

    return (
        <AuthContext.Provider
            value={{ user, token, setUser, setToken, logout, isAuthenticated: !!user, isLoading }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

export function getRoleDashboard(role: UserRole): string {
    const map: Record<UserRole, string> = {
        patient: '/patient/dashboard',
        doctor: '/doctor/dashboard',
        admin: '/admin/dashboard',
        management: '/management/dashboard',
    };
    return map[role] ?? '/login';
}
