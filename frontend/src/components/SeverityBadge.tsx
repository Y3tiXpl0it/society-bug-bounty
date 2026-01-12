// frontend/src/components/SeverityBadge.tsx
import React from 'react';
import { getSeverityInfo, formatSeverityDisplay } from '../utils/severityHelper';


interface SeverityBadgeProps {
    severity: number | null;
    className?: string;
}

const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, className = '' }) => {
    const display = formatSeverityDisplay(severity);
    const info = getSeverityInfo(severity);
    return (
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${info.color} ${className}`}>
            {display}
        </span>
    );
};

export default SeverityBadge;