// frontend/src/components/StatusBadge.tsx
import React from 'react';
import { getStatusInfo } from '../utils/statusHelper';


interface StatusBadgeProps {
    status: string;
    className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
    const info = getStatusInfo(status);
    return (
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${info.color} ${className}`}>
            {info.label}
        </span>
    );
};

export default StatusBadge;