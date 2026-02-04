// frontend/src/components/MyReportsCard.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ReportMyReportsSummary } from '../types/reportTypes';
import { getSeverityInfo } from '../utils/severityHelper';
import { getStatusInfo } from '../utils/statusHelper';

interface MyReportsCardProps {
    report: ReportMyReportsSummary;
    isSelected: boolean;
    onClick: (report: ReportMyReportsSummary) => void;
}

const MyReportsCard: React.FC<MyReportsCardProps> = ({
    report,
    isSelected,
    onClick
}) => {
    const { t } = useTranslation();
    const severityInfo = getSeverityInfo(report.severity);
    const statusInfo = getStatusInfo(report.status);

    return (
        <li
            className={`p-3 rounded cursor-pointer transition-colors border border-gray-200 ${isSelected ? 'bg-gray-100' : 'hover:bg-gray-100'
                }`}
            onClick={() => onClick(report)}
        >
            <div className="font-medium mb-1">{report.title}</div>
            <div className="text-sm mb-1"><strong>{report.program_name}</strong> {t('components.myReportsCard.by')} <em>{report.organization_name}</em></div>
            <div className="flex items-center justify-between">
                <div className="text-xs text-color-secondary">
                    {new Date(report.created_at).toLocaleDateString()}
                </div>
                <div className="flex items-center space-x-1">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${statusInfo.color}`}>
                        {statusInfo.label}
                    </span>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${severityInfo.color}`}>
                        {severityInfo.category} ({(report.severity || 0).toFixed(1)})
                    </span>
                </div>
            </div>
        </li>
    );
};

export default MyReportsCard;