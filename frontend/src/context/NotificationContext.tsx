/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, type ReactNode } from 'react';

export interface NotificationEvent {
    timestamp: number;
    type: 'triggered' | 'normalized';
    value: string | number;
}

export interface NotificationItem {
    id: string;
    severity: 'critical' | 'warning' | 'info';
    title: string;
    deviceName: string;
    parameter: string;
    time: string;
    events: NotificationEvent[];
    userStatus: 'new' | 'acknowledged' | 'ignored';
    type: 'alarm' | 'rule' | 'event';
    ruleName?: string;
}

interface NotificationContextType {
    notifications: NotificationItem[];
    updateNotificationStatus: (id: string, status: 'new' | 'acknowledged' | 'ignored') => void;
    refreshNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    const updateNotificationStatus = (id: string, status: 'new' | 'acknowledged' | 'ignored') => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, userStatus: status } : n)));
    };

    const refreshNotifications = () => {
        setNotifications([]);
    };

    return (
        <NotificationContext.Provider value={{ notifications, updateNotificationStatus, refreshNotifications }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
