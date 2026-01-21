// src/pages/MyReportsPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useAsync } from '../hooks/useAsync';
import reportService from '../services/reportService';
import { type Report, type ReportMyReportsSummary } from '../types/reportTypes';
import MyReportsCard from '../components/MyReportsCard';
import ReportHistoryAndComments from '../components/ReportHistoryAndComments';
import { AsyncContent } from '../components/AsyncContent';
import { getSeverityInfo } from '../utils/severityHelper';
import { getStatusInfo } from '../utils/statusHelper';

/**
 * My Reports page for managing comments on reports.
 * Refactored to use AsyncContent while strictly preserving original component styles.
 */
const MyReportsPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const { user, accessToken, setAccessToken, isLoading: isAuthLoading } = useAuth();
    
    // --- State ---
    const [reports, setReports] = useState<ReportMyReportsSummary[]>([]);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [selectedReportSummary, setSelectedReportSummary] = useState<ReportMyReportsSummary | null>(null);

    // -------------------------------------------------------------------------
    // 1. Fetch Logic: LIST of Reports (Sidebar)
    // -------------------------------------------------------------------------

    const fetchReportsCall = useCallback(async () => {
        return await reportService.getMyReports(accessToken, setAccessToken);
    }, [accessToken, setAccessToken]);

    const reportsAsyncOptions = useMemo(() => ({
        onSuccess: (data: ReportMyReportsSummary[]) => {
            setReports(data);
        },
        // We let AsyncContent handle the error display usually, but the original
        // had a full page error for the list, so we'll handle that in render.
    }), []);

    const { 
        execute: loadReports, 
        loading: isListLoading, 
        error: listError 
    } = useAsync(fetchReportsCall, reportsAsyncOptions);

    // -------------------------------------------------------------------------
    // 2. Fetch Logic: REPORT DETAILS
    // -------------------------------------------------------------------------

    const fetchDetailsCall = useCallback(async (reportId: string) => {
        return await reportService.getReportById(accessToken, reportId, setAccessToken);
    }, [accessToken, setAccessToken]);

    const detailsAsyncOptions = useMemo(() => ({
        onSuccess: (data: Report) => {
            setSelectedReport(data);
        },
        onError: (err: any) => {
             toast.error(String(err) || 'Error loading report details');
        }
    }), []);

    const { 
        execute: loadReportDetails, 
        loading: isDetailsLoading,
        error: detailsError 
    } = useAsync(fetchDetailsCall, detailsAsyncOptions);

    // -------------------------------------------------------------------------
    // 3. Effects & Helpers
    // -------------------------------------------------------------------------

    // Load reports on mount
    useEffect(() => {
        if (!isAuthLoading && user) {
            loadReports();
        }
    }, [isAuthLoading, user, loadReports]);

    // Unified selection logic
    const selectReportLogic = useCallback((reportSummary: ReportMyReportsSummary) => {
        setSelectedReportSummary(reportSummary);
        loadReportDetails(reportSummary.id);
    }, [loadReportDetails]);

    // Auto-select report from URL
    useEffect(() => {
        const reportId = searchParams.get('reportId');
        if (reportId && reports.length > 0 && !selectedReportSummary) {
            const report = reports.find(r => r.id === reportId);
            if (report) {
                selectReportLogic(report);
            }
        }
    }, [searchParams, reports, selectedReportSummary, selectReportLogic]);

    // Sort reports (Client-side sorting)
    const sortedReports = useMemo(() => {
        return [...reports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [reports]);

    const handleReportSelect = (reportSummary: ReportMyReportsSummary) => {
        selectReportLogic(reportSummary);
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
                        <h2 className="text-xl font-semibold mb-4">Your Reports</h2>
                        <div className="flex-1 overflow-y-auto">
                            {/* AsyncContent handles list loading/error inside the sidebar */}
                            <AsyncContent
                                loading={isListLoading}
                                error={listError}
                                data={sortedReports}
                                minLoadingTime={300}
                            >
                                {sortedReports.length === 0 ? (
                                    <p>No reports found.</p>
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
                            data={true} // Always render children if no error/loading, logical check is inside
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
                                                            Warning: The program associated with this report has been deleted.
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
                                                    <p className="text-sm text-gray-500">Organization:</p>
                                                    <p className="text-sm text-gray-900 ml-2">{selectedReportSummary.organization_name}</p>
                                                </div>
                                                <div className="flex items-center">
                                                    <p className="text-sm text-gray-500">Program:</p>
                                                    <p className="text-sm text-gray-900 ml-2">{selectedReportSummary.program_name}</p>
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex items-center mb-2">
                                                    <p className="text-sm text-gray-500">Status:</p>
                                                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ml-2 ${getStatusInfo(selectedReportSummary.status).color}`}>
                                                        {getStatusInfo(selectedReportSummary.status).label}
                                                    </span>
                                                </div>
                                                <div className="flex items-center">
                                                    <p className="text-sm text-gray-500">Severity Score:</p>
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
                                                    <p className="text-sm text-gray-500">Submitted:</p>
                                                    <p className="text-sm text-gray-900 ml-2">{new Date(selectedReportSummary.created_at).toLocaleString()}</p>
                                                </div>
                                                <div className="flex items-center">
                                                    <p className="text-sm text-gray-500">Last Updated:</p>
                                                    <p className="text-sm text-gray-900 ml-2">{new Date(selectedReportSummary.updated_at).toLocaleString()}</p>
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
                                    <p>Select a report from the left sidebar to view details.</p>
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