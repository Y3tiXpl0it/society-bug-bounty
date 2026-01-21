// src/pages/ManageReportsPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import reportService from '../services/reportService';
import programService from '../services/programService';
import { type PaginatedReportSummaryResponse, type ReportSummary } from '../types/reportTypes';
import { type ProgramDetail } from '../types/programTypes';
import ManageReportCard from '../components/ManageReportCard';
import { AsyncContent } from '../components/AsyncContent';

/**
 * A page component for organization members to view all reports submitted to a specific program.
 * Refactored to use AsyncContent while preserving exact original styles.
 */
const ManageReportsPage: React.FC = () => {
    // --- URL Parameters ---
    const { orgSlug, progSlug } = useParams<{
        orgSlug: string;
        progSlug: string;
    }>();

    // --- Component State ---
    const [reports, setReports] = useState<ReportSummary[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [program, setProgram] = useState<ProgramDetail | null>(null);
    
    const { accessToken, setAccessToken } = useAuth();
    const LIMIT = 10; // Number of reports to fetch per page.

    // -------------------------------------------------------------------------
    // 1. Fetch Logic for REPORTS (Paginated)
    // -------------------------------------------------------------------------

    const fetchReportsCall = useCallback(async () => {
        if (!orgSlug || !progSlug) throw new Error("Invalid parameters");
             
        return await reportService.getReportsByProgram(
            accessToken,
            orgSlug,
            progSlug,
            currentPage,
            LIMIT,
            setAccessToken
        );
    }, [accessToken, orgSlug, progSlug, currentPage, setAccessToken]);

    const reportsAsyncOptions = useMemo(() => ({
        onSuccess: (data: PaginatedReportSummaryResponse) => {
            setReports(data.reports);
            setTotalPages(Math.ceil(data.total / LIMIT));
        },
        // AsyncContent will handle the error display
    }), []);

    const { 
        execute: loadReports, 
        loading: loadingReports, 
        error: errorReports 
    } = useAsync(fetchReportsCall, reportsAsyncOptions);

    // -------------------------------------------------------------------------
    // 2. Fetch Logic for PROGRAM DETAILS (Metadata)
    // -------------------------------------------------------------------------

    const fetchProgramCall = useCallback(async () => {
        if (!orgSlug || !progSlug) throw new Error("Invalid parameters");

        return await programService.getProgramBySlug(
            accessToken,
            orgSlug,
            progSlug,
            setAccessToken
        );
    }, [accessToken, orgSlug, progSlug, setAccessToken]);

    const programAsyncOptions = useMemo(() => ({
        onSuccess: (data: ProgramDetail) => {
            setProgram(data);
        },
    }), []);

    const { 
        execute: loadProgram,
        loading: loadingProgram,
        error: errorProgram
    } = useAsync(fetchProgramCall, programAsyncOptions);

    // -------------------------------------------------------------------------
    // 3. Effects
    // -------------------------------------------------------------------------

    // Fetch reports when page or params change
    useEffect(() => {
        loadReports();
    }, [loadReports]);

    // Fetch program details only when params change (not on pagination)
    useEffect(() => {
        loadProgram();
    }, [loadProgram]);

    // -------------------------------------------------------------------------
    // 4. Handlers
    // -------------------------------------------------------------------------

    const handlePrevPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    };

    const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    };

    // Combine loading/error states for a unified UI experience
    const isLoadingCombined = loadingReports || loadingProgram;
    const errorCombined = errorReports || errorProgram;

    // -------------------------------------------------------------------------
    // 5. Render
    // -------------------------------------------------------------------------

    return (
        // Restored "h-auto" from original instead of "min-h-screen"
        <div className="h-auto bg-gray-50 py-8">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Logic from refactor to prevent crashing, but visually same as original */}
                <h1 className="text-3xl font-bold mb-6">
                    Reports for {program ? program.name : (progSlug || 'Program')}
                </h1>

                <AsyncContent
                    loading={isLoadingCombined}
                    error={errorCombined}
                    data={reports}
                    minLoadingTime={300}
                    keepDataWhileLoading={false} 
                >
                    {reports.length === 0 ? (
                        <div className="text-center py-10 px-6 bg-white shadow rounded-lg">
                            <p>No reports have been submitted to this program yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {reports.map((report) => (
                                <ManageReportCard key={report.id} report={report} />
                            ))}
                        </div>
                    )}

                    {/* --- Pagination Controls --- */}
                    {totalPages > 1 && reports.length > 0 && (
                        <div className="flex justify-center items-center mt-8 space-x-4">
                            <button
                                onClick={handlePrevPage}
                                disabled={currentPage === 1}
                                // Restored exact original classes (removed cursor-pointer & disabled:cursor-not-allowed)
                                className="px-4 py-2 bg-white border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors"
                            >
                                {'<'}
                            </button>
                            <span>
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={handleNextPage}
                                disabled={currentPage === totalPages}
                                // Restored exact original classes
                                className="px-4 py-2 bg-white border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors"
                            >
                                {'>'}
                            </button>
                        </div>
                    )}
                </AsyncContent>
            </div>
        </div>
    );
};

export default ManageReportsPage;