// src/pages/MyReportsPage.tsx
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAsync } from '../hooks/useAsync'; // Import useAsync
import reportService from '../services/reportService';
import { type Report, type ReportMyReportsSummary } from '../types/reportTypes';
import MyReportsCard from '../components/MyReportsCard';
import ReportHistoryAndComments from '../components/ReportHistoryAndComments';
import { getSeverityInfo } from '../utils/severityHelper';
import { getStatusInfo } from '../utils/statusHelper';
import toast from 'react-hot-toast';

/**
 * My Reports page for managing comments on reports.
 */
const MyReportsPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [reports, setReports] = useState<ReportMyReportsSummary[]>([]);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [selectedReportSummary, setSelectedReportSummary] = useState<ReportMyReportsSummary | null>(null);
    
    const { user, accessToken, setAccessToken, isLoading: isAuthLoading } = useAuth();

    // --- 1. Hook to load the list of reports ---
    const { 
        execute: loadReports, 
        loading: isListLoading, 
        error: listError 
    } = useAsync(
        async () => {
            return await reportService.getMyReports(accessToken, setAccessToken);
        },
        {
            onSuccess: (data) => {
                setReports(data);
            },
        }
    );

    // --- 2. Hook to load the details of a report ---
    const { 
        execute: loadReportDetails, 
        loading: isDetailsLoading 
    } = useAsync(
        async (reportId: string) => {
            return await reportService.getReportById(accessToken, reportId, setAccessToken);
        },
        {
            onSuccess: (data) => {
                setSelectedReport(data);
            },
            onError: (err) => {
                toast.error(String(err) || 'Error loading report details');
            }
        }
    );

    // Load reports on mount (if there is a user)
    useEffect(() => {
        if (!isAuthLoading && user) {
            loadReports();
        }
    }, [user, isAuthLoading]); // accessToken is handled within the closure of useAsync/service

    // Auto-select report from URL
    useEffect(() => {
        const reportId = searchParams.get('reportId');
        if (reportId && reports.length > 0 && !selectedReportSummary) {
            const report = reports.find(r => r.id === reportId);
            if (report) {
                // We call the selection logic without a click event
                selectReportLogic(report);
            }
        }
    }, [searchParams, reports, selectedReportSummary]);

    // Sort reports (Client-side sorting)
    const sortedReports = [...reports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Unified selection logic
    const selectReportLogic = (reportSummary: ReportMyReportsSummary) => {
        setSelectedReportSummary(reportSummary);
        // We execute the details hook
        loadReportDetails(reportSummary.id);
    };

    const handleReportSelect = (reportSummary: ReportMyReportsSummary) => {
        selectReportLogic(reportSummary);
    };

    // --- Centralized Conditional Rendering ---

    if (isAuthLoading || isListLoading) {
        return <div className="text-center p-8">Loading My Reports...</div>;
    }

    // We use the error coming from useAsync
    if (listError) {
        return <div className="text-center text-red-600 bg-red-100 p-4 rounded-md">{listError}</div>;
    }

    return (
        <div className="h-full">
            <div className="w-full px-4 sm:px-6 lg:px-8 h-full py-8">
                <div className="flex gap-6">
                    {/* Left Sidebar - Programs */}
                    <div className="w-96 bg-white shadow rounded p-4 h-195 flex flex-col">
                        <h2 className="text-xl font-semibold mb-4">Your Reports</h2>
                        <div className="flex-1 overflow-y-auto">
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
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 bg-white shadow rounded overflow-hidden self-start flex flex-col">
                        {isDetailsLoading ? (
                             <div className="p-8 text-center text-gray-500">Loading report details...</div>
                        ) : selectedReportSummary ? (
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
                            <div className="p-6 text-center text-gray-500">
                                <p>Select a report from the left sidebar to view details.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Spacer for bottom margin */}
                <div className="h-8"></div>
            </div>
        </div>
    );
};

export default MyReportsPage;
