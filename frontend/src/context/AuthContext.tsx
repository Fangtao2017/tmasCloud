/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || '';

export interface AuthUser {
    id: number;
    username: string;
    displayName: string;
    role: 'admin' | 'site_admin' | 'operator' | 'viewer';
    siteIds: number[] | null; // null = admin (all sites)
}

interface AuthContextType {
    user: AuthUser | null;
    role: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // On mount: check if a valid session cookie already exists
    useEffect(() => {
        fetch(`${API}/auth/me`, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then(({ user: u }) => setUser(u))
            .catch(() => setUser(null))
            .finally(() => setIsLoading(false));
    }, []);

    const login = async (username: string, password: string) => {
        const res = await fetch(`${API}/auth/login`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.message || 'Login failed');
        }
        const { user: u } = await res.json();
        setUser(u);
    };

    const logout = async () => {
        await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            role: user?.role ?? null,
            isAuthenticated: !!user,
            isLoading,
            login,
            logout,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
