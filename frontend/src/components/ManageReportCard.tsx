// frontend/src/components/ManageReportCard.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { ReportSummary } from '../types/reportTypes';
import { getSeverityInfo } from '../utils/severityHelper';
import { getStatusInfo } from '../utils/statusHelper';

interface ManageReportCardProps {
    report: ReportSummary;
}

/**
 * Renders a card for managing a single report.
 * This is used on the organization's private "Manage Reports" page.
 */
const ManageReportCard: React.FC<ManageReportCardProps> = ({ report }) => {
    const { t } = useTranslation();
    const severityInfo = getSeverityInfo(report.severity!);

    return (
        <div className="bg-white border border-gray-200 rounded p-4 transition-shadow hover:shadow-lg">
            <div className="flex justify-between items-center">
                <div className="flex-grow">
                    <h3 className="text-lg font-semibold mb-3">{report.title}</h3>
                    <div className="flex items-center space-x-4 text-sm">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusInfo(report.status).color}`}>
                            {getStatusInfo(report.status).label}
                        </span>
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${severityInfo.color}`}>
                            {severityInfo.category} ({report.severity!.toFixed(1)})
                        </span>
                        <span>
                            {t('components.manageReportCard.submittedBy')} <strong>{report.hacker_name}</strong> {t('components.manageReportCard.on')}{' '}
                            <strong>{new Date(report.created_at).toLocaleDateString()}</strong>
                        </span>
                    </div>
                </div>
                <Link
                    to={`/reports/${report.id}`}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-md transition duration-300 ml-4 inline-block h-10 flex items-center justify-center"
                >
                    {t('components.manageReportCard.viewDetails')}
                </Link>
            </div>

        </div>
    );
};

export default ManageReportCard;
