// frontend/src/components/StatusBadge.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getStatusInfo } from '../utils/statusHelper';


interface StatusBadgeProps {
    status: string;
    className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
    const { t } = useTranslation();
    const info = getStatusInfo(status);

    // Map status value to translation key
    // We can assume format components.statusSelector.[value camelCased]
    const getTranslatedLabel = (val: string) => {
        const keyMap: Record<string, string> = {
            'received': 'received',
            'in_review': 'inReview',
            'accepted': 'accepted',
            'rejected': 'rejected',
            'duplicate': 'duplicate',
            'out_of_scope': 'outOfScope',
            'resolved': 'resolved',
        };
        const key = keyMap[val];
        return key ? t(`components.statusSelector.${key}`) : info.label;
    };

    return (
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${info.color} ${className}`}>
            {getTranslatedLabel(info.value)}
        </span>
    );
};

export default StatusBadge;