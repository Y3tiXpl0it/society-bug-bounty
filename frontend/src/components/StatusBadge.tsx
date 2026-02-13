// frontend/src/components/StatusBadge.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getStatusInfo, getTranslatedStatus } from '../utils/statusHelper';


interface StatusBadgeProps {
    status: string;
    className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
    const { t } = useTranslation();
    const info = getStatusInfo(status);

    return (
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${info.color} ${className}`}>
            {getTranslatedStatus(info.value, t)}
        </span>
    );
};

export default StatusBadge;