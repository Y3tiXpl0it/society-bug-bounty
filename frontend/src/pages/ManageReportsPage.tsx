// src/pages/ManageReportsPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import reportService from '../services/reportService';
import programService from '../services/programService';
import { type PaginatedReportSummaryResponse, type ReportSummary } from '../types/reportTypes';
import { type ProgramDetail } from '../types/programTypes';
import ManageReportCard from '../components/ManageReportCard';

/**
 * A page component for organization members to view all reports submitted to a specific program.
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

    // Effect to fetch reports once the component mounts and params are available.
    const { execute: fetchReports, loading, error } = useAsync(
        async () => {
             if (!orgSlug || !progSlug) throw new Error("Invalid parameters");
             
             return await reportService.getReportsByProgram(
                accessToken,
                orgSlug,
                progSlug,
                currentPage,
                LIMIT,
                setAccessToken
            );
        },
        {
            onSuccess: (data: PaginatedReportSummaryResponse) => {
                setReports(data.reports);
                setTotalPages(Math.ceil(data.total / LIMIT));
            },
        }
    );

    // Effect to fetch program details.
    const { execute: fetchProgram } = useAsync(
        async () => {
            if (!orgSlug || !progSlug) throw new Error("Invalid parameters");

            return await programService.getProgramBySlug(
                accessToken,
                orgSlug,
                progSlug,
                setAccessToken
            );
        },
        {
            onSuccess: (data: ProgramDetail) => {
                setProgram(data);
            },
        }
    );

    useEffect(() => {
        if (accessToken && orgSlug && progSlug) {
            fetchReports();
            fetchProgram();
        }
    }, [accessToken, orgSlug, progSlug, currentPage]);

    const handlePrevPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    };

    const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    };

    // --- Conditional Rendering ---

    // Display a loading state while fetching.
    if (loading) {
        return <div className="text-center p-8">Loading reports...</div>;
    }

    // Display an error message if the fetch failed.
    if (error) {
        return <div className="text-center text-red-600 bg-red-100 p-4 rounded-md">{error}</div>;
    }

    return (
        <div className="h-auto bg-gray-50 py-8">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-bold mb-6">Reports for {program?.name || progSlug}</h1>

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
                {totalPages > 1 && (
                    <div className="flex justify-center items-center mt-8 space-x-4">
                        <button
                            onClick={handlePrevPage}
                            disabled={currentPage === 1}
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
                            className="px-4 py-2 bg-white border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors"
                        >
                            {'>'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManageReportsPage;
