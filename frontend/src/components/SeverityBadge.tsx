// frontend/src/components/SeverityBadge.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getSeverityInfo, getTranslatedSeverity } from '../utils/severityHelper';


interface SeverityBadgeProps {
    severity: number | null;
    className?: string;
}

const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, className = '' }) => {
    const { t } = useTranslation();
    const info = getSeverityInfo(severity);
    const displayScore = severity ? severity.toFixed(1) : '0.0';

    // Use helper to translate category
    const translatedCategory = getTranslatedSeverity(severity, t);
    const display = `${translatedCategory} (${displayScore})`;

    return (
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${info.color} ${className}`}>
            {display}
        </span>
    );
};

export default SeverityBadge;