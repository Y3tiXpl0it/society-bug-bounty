// src/pages/MyReportsPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import reportService from '../services/reportService';
import { type ReportMyReportsSummary } from '../types/reportTypes';
import MyReportsCard from '../components/MyReportsCard';
import ReportHistoryAndComments from '../components/ReportHistoryAndComments';
import { AsyncContent } from '../components/AsyncContent';
import { getSeverityInfo } from '../utils/severityHelper';
import { getStatusInfo } from '../utils/statusHelper';
import { formatDateTime } from '../utils/dateHelper';

/**
 * My Reports page for managing comments on reports.
 * Refactored to use TanStack Query while strictly preserving original component styles.
 */
const MyReportsPage: React.FC = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const { user, accessToken, setAccessToken, isLoading: isAuthLoading } = useAuth();

    // --- State ---
    // We keep the summary selection state to highlight the sidebar card immediately
    const [selectedReportSummary, setSelectedReportSummary] = useState<ReportMyReportsSummary | null>(null);

    // -------------------------------------------------------------------------
    // 1. Fetch Logic: LIST of Reports (Sidebar)
    // -------------------------------------------------------------------------

    const {
        data: reportsData,
        isLoading: isListLoading,
        error: listError
    } = useQuery({
        queryKey: ['myReports', accessToken],
        queryFn: () => reportService.getMyReports(accessToken, setAccessToken),
        enabled: !isAuthLoading && !!user,
    });

    const reports = reportsData || [];

    // -------------------------------------------------------------------------
    // 2. Fetch Logic: REPORT DETAILS
    // -------------------------------------------------------------------------

    const selectedId = selectedReportSummary?.id;

    const {
        data: selectedReport,
        isLoading: isDetailsLoading,
        error: detailsError
    } = useQuery({
        queryKey: ['report', selectedId, accessToken],
        queryFn: () => {
            if (!selectedId) throw new Error(t('myReports.noReportSelected'));
            return reportService.getReportById(accessToken, selectedId, setAccessToken);
        },
        // Only fetch details when an ID is actually selected
        enabled: !!selectedId && !!accessToken,
    });

    // -------------------------------------------------------------------------
    // 3. Effects & Helpers
    // -------------------------------------------------------------------------

    // Auto-select report from URL once the list is loaded
    useEffect(() => {
        const reportId = searchParams.get('reportId');
        if (reportId && reports.length > 0 && !selectedReportSummary) {
            const report = reports.find(r => r.id === reportId);
            if (report) {
                setSelectedReportSummary(report);
            }
        }
    }, [searchParams, reports, selectedReportSummary]);

    // Sort reports (Client-side sorting)
    const sortedReports = useMemo(() => {
        return [...reports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [reports]);

    const handleReportSelect = (reportSummary: ReportMyReportsSummary) => {
        // Just update the selection; useQuery will handle the fetching automatically due to dependency change
        setSelectedReportSummary(reportSummary);
    };

    // -------------------------------------------------------------------------
    // 4. Render
    // -------------------------------------------------------------------------

    // Keep strict original full-page loading for Auth
    if (isAuthLoading) {
        return <div className="text-center p-8">Loading My Reports...</div>;
    }

    return (
        <div className="h-full">
            <div className="w-full px-4 sm:px-6 lg:px-8 h-full py-8">
                <div className="flex gap-6">

                    {/* Left Sidebar - Programs */}
                    {/* Kept exact original class 'h-195' */}
                    <div className="w-96 bg-white shadow rounded p-4 h-195 flex flex-col">
                        <h2 className="text-xl font-semibold mb-4">{t('myReports.sidebarTitle')}</h2>
                        <div className="flex-1 overflow-y-auto">
                            {/* AsyncContent handles list loading/error inside the sidebar */}
                            <AsyncContent
                                loading={isListLoading}
                                error={listError}
                                data={sortedReports}
                                minLoadingTime={300}
                            >
                                {sortedReports.length === 0 ? (
                                    <p>{t('myReports.noReports')}</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {sortedReports.map((report) => (
                                            <MyReportsCard
                                                key={report.id}
                                                report={report}
                                                isSelected={selectedReportSummary?.id === report.id}
                                                onClick={handleReportSelect}
                                            />
                                        ))}
                                    </ul>
                                )}
                            </AsyncContent>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 bg-white shadow rounded overflow-hidden self-start flex flex-col">
                        <AsyncContent
                            loading={isDetailsLoading}
                            error={detailsError}
                            // Always render children if no error/loading (logical check is inside)
                            // Note: if nothing is selected, isLoading is false, so it renders children immediately
                            data={true}
                            minLoadingTime={300}
                        >
                            {selectedReportSummary ? (
                                <>
                                    {selectedReport?.program?.deleted_at && (
                                        <div className="bg-red-600">
                                            <div className="py-2 px-4">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0">
                                                        <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                        </svg>
                                                    </div>
                                                    <div className="ml-3">
                                                        <p className="text-sm font-medium text-white">
                                                            {t('myReports.programDeletedWarning')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {/* Report Header */}
                                    <div className="p-6 border-b border-gray-200">
                                        <h2 className="text-xl font-bold mb-4">{selectedReportSummary.title}</h2>
                                        <div className="grid grid-cols-3 gap-6">
                                            <div>
                                                <div className="flex items-center mb-2">
                                                    <p className="text-sm text-gray-500">{t('myReports.labels.organization')}</p>
                                                    <p className="text-sm text-gray-900 ml-2">{selectedReportSummary.organization_name}</p>
                                                </div>
                                                <div className="flex items-center">
                                                    <p className="text-sm text-gray-500">{t('myReports.labels.program')}</p>
                                                    <p className="text-sm text-gray-900 ml-2">{selectedReportSummary.program_name}</p>
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex items-center mb-2">
                                                    <p className="text-sm text-gray-500">{t('myReports.labels.status')}</p>
                                                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ml-2 ${getStatusInfo(selectedReportSummary.status).color}`}>
                                                        {getStatusInfo(selectedReportSummary.status).label}
                                                    </span>
                                                </div>
                                                <div className="flex items-center">
                                                    <p className="text-sm text-gray-500">{t('myReports.labels.severity')}</p>
                                                    {(() => {
                                                        const severityInfo = getSeverityInfo(selectedReportSummary.severity);
                                                        return (
                                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ml-2 ${severityInfo.color}`}>
                                                                {severityInfo.category} ({(selectedReportSummary.severity || 0).toFixed(1)})
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex items-center mb-2">
                                                    <p className="text-sm text-gray-500">{t('myReports.labels.submitted')}</p>
                                                    <p className="text-sm text-gray-900 ml-2">{formatDateTime(selectedReportSummary.created_at)}</p>
                                                </div>
                                                <div className="flex items-center">
                                                    <p className="text-sm text-gray-500">{t('myReports.labels.lastUpdated')}</p>
                                                    <p className="text-sm text-gray-900 ml-2">{formatDateTime(selectedReportSummary.updated_at)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Report History and Comments */}
                                    <div className="flex-1 overflow-y-auto">
                                        <ReportHistoryAndComments
                                            reportId={selectedReportSummary.id}
                                            reportDescription={selectedReport?.description}
                                            reportAssets={selectedReport?.assets}
                                            isProgramDeleted={!!selectedReport?.program?.deleted_at}
                                        />
                                    </div>
                                </>
                            ) : (
                                // RESTORED: Original simple empty state (no SVG, no Flex column centering)
                                <div className="p-6 text-center text-gray-500">
                                    <p>{t('myReports.selectPrompt')}</p>
                                </div>
                            )}
                        </AsyncContent>
                    </div>
                </div>

                {/* Spacer for bottom margin (Restored) */}
                <div className="h-8"></div>
            </div>
        </div>
    );
};

export default MyReportsPage;