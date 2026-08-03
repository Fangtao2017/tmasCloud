import React from 'react';
import { Card } from 'antd';

interface ResponsiveTableContainerProps {
    children: React.ReactNode;
    title?: React.ReactNode;
    extra?: React.ReactNode;
    className?: string;
}

export const ResponsiveTableContainer: React.FC<ResponsiveTableContainerProps> = ({ 
    children, 
    title, 
    extra,
    className 
}) => {
    return (
        <Card 
            title={title} 
            extra={extra}
            className={className}
            style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                flex: 1, 
                minHeight: 0, // Critical for nested flex scrolling
                overflow: 'hidden' // Prevent card itself from scrolling
            }}
            bodyStyle={{ 
                flex: 1, 
                minHeight: 0, 
                overflow: 'hidden', // Let Table handle scrolling
                display: 'flex',
                flexDirection: 'column',
                padding: '12px' // Adjust padding as needed
            }}
        >
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {children}
            </div>
        </Card>
    );
};
