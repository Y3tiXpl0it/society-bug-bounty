// src/pages/ReportDetailPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import reportService from '../services/reportService';
import { type Report } from '../types/reportTypes';
import StatusSelector from '../components/StatusSelector';
import SeverityInput from '../components/SeverityInput';
import ReportHistoryAndComments from '../components/ReportHistoryAndComments';
import StatusBadge from '../components/StatusBadge';
import SeverityBadge from '../components/SeverityBadge';
import { useAuth } from '../hooks/useAuth';
import { useAsync } from '../hooks/useAsync';
import { AsyncContent } from '../components/AsyncContent';

/**
 * A page component for viewing the details of a specific report.
 */
const ReportDetailPage: React.FC = () => {
    // --- URL Parameters ---
    const { reportId } = useParams<{ reportId: string }>();

    // --- Component State ---
    const [report, setReport] = useState<Report | null>(null);
    const [openSelector, setOpenSelector] = useState<'status' | 'severity' | null>(null);
    const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState<number>(0);

    // --- Auth Context ---
    const { user, accessToken, setAccessToken } = useAuth();

    // -------------------------------------------------------------------------
    // 1. Hook to fetch the report details
    // -------------------------------------------------------------------------
    
    // Defines the fetch function ensuring stability across renders using useCallback
    const fetchReportFn = useCallback(async () => {
        if (!reportId) throw new Error("Report ID is missing");
        return await reportService.getReportById(accessToken, reportId, setAccessToken);
    }, [accessToken, reportId, setAccessToken]);

    // Memoizes the options to prevent unnecessary re-renders
    const fetchReportOptions = useMemo(() => ({
        onSuccess: (data: Report) => setReport(data),
    }), []);

    // Uses the custom useAsync hook to handle the fetching lifecycle
    const { 
        loading: isLoading, 
        error: fetchError, 
        execute: fetchReport 
    } = useAsync(fetchReportFn, fetchReportOptions);

    // Triggers the fetch operation when the component mounts
    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    // -------------------------------------------------------------------------
    // 2. Hook to handle status updates
    // -------------------------------------------------------------------------
    const updateStatusFn = useCallback(async (newStatus: string) => {
        if (!report) throw new Error("Report not loaded");
        return await reportService.updateReportStatus(accessToken, report.id, newStatus, setAccessToken);
    }, [accessToken, report, setAccessToken]);

    const updateStatusOptions = useMemo(() => ({
        onSuccess: (updatedReport: Report) => {
            setReport(updatedReport);
            setOpenSelector(null);
            setHistoryRefreshTrigger((prev) => prev + 1); 
        }
    }), []);

    const { 
        execute: updateStatus, 
        loading: isUpdatingStatus 
    } = useAsync(updateStatusFn, updateStatusOptions);

    // -------------------------------------------------------------------------
    // 3. Hook to handle severity updates
    // -------------------------------------------------------------------------
    const updateSeverityFn = useCallback(async (newSeverity: any) => {
        if (!report) throw new Error("Report not loaded");
        return await reportService.updateReportSeverity(accessToken, report.id, newSeverity, setAccessToken);
    }, [accessToken, report, setAccessToken]);

    const updateSeverityOptions = useMemo(() => ({
        onSuccess: (updatedReport: Report) => {
            setReport(updatedReport);
            setOpenSelector(null);
            setHistoryRefreshTrigger((prev) => prev + 1);
        }
    }), []);

    const { 
        execute: updateSeverity, 
        loading: isUpdatingSeverity 
    } = useAsync(updateSeverityFn, updateSeverityOptions);

    // --- Event Handlers ---

    const handleStatusChange = (newStatus: string) => {
        updateStatus(newStatus);
    };

    const handleSeverityChange = (newSeverity: any) => {
        updateSeverity(newSeverity);
    };

    // --- Helper Logic ---
    // Determines if the current user has administrative rights for the organization associated with this report
    const isOrgAdmin = report && user?.organizations?.some(org => org.id === report.program.organization.id);
    
    // checks if the associated program has been soft-deleted
    const isProgramDeleted = report && !report.program;

    // --- Render Logic ---

    return (
        <div className="h-full">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-full py-8">
                
                <AsyncContent
                    loading={isLoading}
                    error={fetchError}
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
                                                    Warning: The program associated with this report has been deleted.
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
                                                <p className="text-sm text-gray-500">Organization:</p>
                                                <p className="text-sm text-gray-900 ml-2">{report.program.organization.name}</p>
                                            </div>
                                            <div className="flex items-center">
                                                <p className="text-sm text-gray-500">Program:</p>
                                                <p className="text-sm text-gray-900 ml-2">{isProgramDeleted ? 'Deleted Program' : report.program.name}</p>
                                            </div>
                                        </div>

                                        {/* Column 2: Status & Severity Controls */}
                                        <div>
                                            <div className="flex items-center mb-2">
                                                <p className="text-sm text-gray-500">Status:</p>
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
                                                <p className="text-sm text-gray-500">Severity Score:</p>
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
                                                <p className="text-sm text-gray-500">Submitted:</p>
                                                <p className="text-sm text-gray-900 ml-2">{new Date(report.created_at).toLocaleString()}</p>
                                            </div>
                                            <div className="flex items-center">
                                                <p className="text-sm text-gray-500">Last Updated:</p>
                                                <p className="text-sm text-gray-900 ml-2">{new Date(report.updated_at).toLocaleString()}</p>
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