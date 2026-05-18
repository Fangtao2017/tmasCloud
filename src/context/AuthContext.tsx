/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo, useState } from 'react';

export interface AuthUser {
    id: number;
    username: string;
    displayName?: string;
    email?: string;
    lastLoginAt?: string;
}

interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    role: string | null;
    permissions: string[];
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, _password: string) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
    hasPermission: (_permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>({ id: 1, username: 'cloud-admin', displayName: 'Cloud Admin' });

    const value = useMemo<AuthContextType>(() => {
        const token = 'local-mode-token';
        return {
            user,
            token,
            role: 'admin',
            permissions: [],
            isAuthenticated: true,
            isLoading: false,
            login: async (username: string) => {
                setUser({ id: 1, username, displayName: username });
            },
            logout: () => {
                setUser(null);
            },
            refreshUser: async () => {
                return;
            },
            hasPermission: () => true
        };
    }, [user]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
