// src/pages/ReportDetailPage.tsx
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import reportService from '../services/reportService';
import notificationService from '../services/notificationService'; // Import notificationService
import StatusSelector from '../components/StatusSelector';
import SeverityInput from '../components/SeverityInput';
import ReportHistoryAndComments from '../components/ReportHistoryAndComments';
import StatusBadge from '../components/StatusBadge';
import SeverityBadge from '../components/SeverityBadge';
import { formatDateTime } from '../utils/dateHelper';
import { useAuth } from '../hooks/useAuth';
import { AsyncContent } from '../components/AsyncContent';

/**
 * A page component for viewing the details of a specific report.
 * Refactored to use TanStack Query instead of useAsync.
 */
const ReportDetailPage: React.FC = () => {
    const { t } = useTranslation();
    // --- URL Parameters ---
    const { reportId } = useParams<{ reportId: string }>();

    // --- Component State ---
    const [openSelector, setOpenSelector] = useState<'status' | 'severity' | null>(null);
    const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState<number>(0);

    // --- Auth Context ---
    const { user, accessToken, setAccessToken } = useAuth();
    const queryClient = useQueryClient();

    // -------------------------------------------------------------------------
    // 1. Data Fetching (Get Report Details)
    // -------------------------------------------------------------------------

    const {
        data: report,
        isLoading,
        error
    } = useQuery({
        queryKey: ['report', reportId, accessToken],
        queryFn: () => {
            if (!reportId) throw new Error("Report ID is missing");
            return reportService.getReportById(accessToken, reportId, setAccessToken);
        },
        enabled: !!reportId,
    });

    // --- Auto-Mark Notifications as Read ---
    // When the user views the report, mark all related notifications as read.
    // This helps the Smart Check logic on the backend to skip sending emails.
    React.useEffect(() => {
        if (reportId && accessToken) {
            notificationService.markRelatedNotificationsAsRead(accessToken, reportId, setAccessToken)
                .catch(err => console.error("Failed to mark related notifications as read", err));
        }
    }, [reportId, accessToken, setAccessToken]);

    // -------------------------------------------------------------------------
    // 2. Mutations (Update Status & Severity)
    // -------------------------------------------------------------------------

    const { mutate: updateStatus, isPending: isUpdatingStatus } = useMutation({
        mutationFn: (newStatus: string) => {
            if (!report) throw new Error("Report not loaded");
            return reportService.updateReportStatus(accessToken, report.id, newStatus, setAccessToken);
        },
        onSuccess: (updatedReport) => {
            // Update the cache immediately with the new report data
            queryClient.setQueryData(['report', reportId, accessToken], updatedReport);
            setOpenSelector(null);
            // Trigger refresh of history component to show the new status change event
            setHistoryRefreshTrigger((prev) => prev + 1);
        }
    });

    const { mutate: updateSeverity, isPending: isUpdatingSeverity } = useMutation({
        mutationFn: (newSeverity: any) => {
            if (!report) throw new Error("Report not loaded");
            return reportService.updateReportSeverity(accessToken, report.id, newSeverity, setAccessToken);
        },
        onSuccess: (updatedReport) => {
            // Update the cache immediately
            queryClient.setQueryData(['report', reportId, accessToken], updatedReport);
            setOpenSelector(null);
            // Trigger refresh of history component
            setHistoryRefreshTrigger((prev) => prev + 1);
        }
    });

    // --- Event Handlers ---

    const handleStatusChange = (newStatus: string) => {
        updateStatus(newStatus);
    };

    const handleSeverityChange = (newSeverity: any) => {
        updateSeverity(newSeverity);
    };

    // --- Helper Logic ---

    // Determines if the current user has administrative rights for the organization
    const isOrgAdmin = report && user?.organizations?.some(org => org.id === report.program.organization.id);

    // Checks if the associated program has been soft-deleted (program is null/missing)
    const isProgramDeleted = report && !report.program;

    // --- Render Logic ---

    return (
        <div className="h-full">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-full py-8">

                <AsyncContent
                    loading={isLoading}
                    error={error}
                    data={report}
                    minLoadingTime={300}
                >
                    {report && (
                        <>
                            {/* Warning Banner for Deleted Programs */}
                            {isProgramDeleted && (
                                <div className="bg-red-600 mb-6 rounded shadow">
                                    <div className="py-2 px-4">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0">
                                                <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                            </div>
                                            <div className="ml-3">
                                                <p className="text-sm font-medium text-white">
                                                    {t('reportDetail.programDeletedWarning')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-white shadow rounded overflow-hidden self-start flex flex-col">

                                {/* Report Header Section */}
                                <div className="p-6 border-b border-gray-200">
                                    <h1 className="text-xl font-bold mb-4">{report.title}</h1>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                                        {/* Column 1: Organization & Program Info */}
                                        <div>
                                            <div className="flex items-center mb-2">
                                                <p className="text-sm text-gray-500">{t('reportDetail.labels.organization')}</p>
                                                <p className="text-sm text-gray-900 ml-2">{report.program.organization.name}</p>
                                            </div>
                                            <div className="flex items-center">
                                                <p className="text-sm text-gray-500">{t('reportDetail.labels.program')}</p>
                                                <p className="text-sm text-gray-900 ml-2">{isProgramDeleted ? t('reportDetail.deletedProgram') : report.program.name}</p>
                                            </div>
                                        </div>

                                        {/* Column 2: Status & Severity Controls */}
                                        <div>
                                            <div className="flex items-center mb-2">
                                                <p className="text-sm text-gray-500">{t('reportDetail.labels.status')}</p>
                                                {isOrgAdmin ? (
                                                    <div className="ml-2 relative">
                                                        <StatusSelector
                                                            currentStatus={report.status}
                                                            onStatusChange={handleStatusChange}
                                                            isUpdating={isUpdatingStatus}
                                                            isOpen={openSelector === 'status'}
                                                            onToggle={() => setOpenSelector(openSelector === 'status' ? null : 'status')}
                                                            onClose={() => setOpenSelector(null)}
                                                        />
                                                    </div>
                                                ) : (
                                                    <StatusBadge status={report.status} className="ml-2" />
                                                )}
                                            </div>
                                            <div className="flex items-center">
                                                <p className="text-sm text-gray-500">{t('reportDetail.labels.severity')}</p>
                                                {isOrgAdmin ? (
                                                    <div className="ml-2 relative">
                                                        <SeverityInput
                                                            currentSeverity={report.severity}
                                                            onSeverityChange={handleSeverityChange}
                                                            isUpdating={isUpdatingSeverity}
                                                            isOpen={openSelector === 'severity'}
                                                            onToggle={() => setOpenSelector(openSelector === 'severity' ? null : 'severity')}
                                                            onClose={() => setOpenSelector(null)}
                                                        />
                                                    </div>
                                                ) : (
                                                    <SeverityBadge severity={report.severity} className="ml-2" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Column 3: Timestamps */}
                                        <div>
                                            <div className="flex items-center mb-2">
                                                <p className="text-sm text-gray-500">{t('reportDetail.labels.submitted')}</p>
                                                <p className="text-sm text-gray-900 ml-2">{formatDateTime(report.created_at)}</p>
                                            </div>
                                            <div className="flex items-center">
                                                <p className="text-sm text-gray-500">{t('reportDetail.labels.lastUpdated')}</p>
                                                <p className="text-sm text-gray-900 ml-2">{formatDateTime(report.updated_at)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Report History and Comments Section */}
                                <div className="flex-1 overflow-y-auto">
                                    <ReportHistoryAndComments
                                        reportId={report.id}
                                        reportDescription={report.description}
                                        reportAssets={report.assets}
                                        refreshTrigger={historyRefreshTrigger}
                                        isProgramDeleted={!!isProgramDeleted}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </AsyncContent>

                {/* Spacer for bottom margin */}
                <div className="h-8"></div>
            </div>
        </div>
    );
};

export default ReportDetailPage;