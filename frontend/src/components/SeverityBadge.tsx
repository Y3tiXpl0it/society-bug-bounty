// frontend/src/components/SeverityBadge.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getSeverityInfo } from '../utils/severityHelper';


interface SeverityBadgeProps {
    severity: number | null;
    className?: string;
}

const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, className = '' }) => {
    const { t } = useTranslation();
    const info = getSeverityInfo(severity);

    // Map severity category to translation
    const getTranslatedCategory = (cat: string) => {
        // Categories from helper: None, Low, Medium, High, Critical, Unknown
        const keyMap: Record<string, string> = {
            'None': 'none',
            'Low': 'low',
            'Medium': 'medium',
            'High': 'high',
            'Critical': 'critical',
            'Unknown': 'unknown'
        };
        const key = keyMap[cat];
        return key ? t(`components.severityBadge.${key}`) : cat;
    };

    const displayScore = severity ? severity.toFixed(1) : '0.0';
    const display = `${getTranslatedCategory(info.category)} (${displayScore})`;

    return (
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${info.color} ${className}`}>
            {display}
        </span>
    );
};

export default SeverityBadge;