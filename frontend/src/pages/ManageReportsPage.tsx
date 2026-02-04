// src/pages/ManageReportsPage.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import reportService from '../services/reportService';
import programService from '../services/programService';
import ManageReportCard from '../components/ManageReportCard';
import { AsyncContent } from '../components/AsyncContent';

/**
 * A page component for organization members to view all reports submitted to a specific program.
 * Refactored to use TanStack Query for data fetching and state management.
 */
const ManageReportsPage: React.FC = () => {
    // --- URL Parameters ---
    const { orgSlug, progSlug } = useParams<{
        orgSlug: string;
        progSlug: string;
    }>();

    // --- Component State ---
    const { t } = useTranslation();
    const [currentPage, setCurrentPage] = useState(1);
    const { accessToken, setAccessToken } = useAuth();
    const LIMIT = 10; // Number of reports to fetch per page.

    // -------------------------------------------------------------------------
    // 1. Fetch Logic for PROGRAM DETAILS (Metadata)
    // -------------------------------------------------------------------------

    const {
        data: program,
        isLoading: loadingProgram,
        error: errorProgram
    } = useQuery({
        queryKey: ['program', orgSlug, progSlug, accessToken],
        queryFn: () => {
            if (!orgSlug || !progSlug) throw new Error(t('manageReports.invalidParameters'));
            return programService.getProgramBySlug(
                accessToken,
                orgSlug,
                progSlug,
                setAccessToken
            );
        },
        enabled: !!orgSlug && !!progSlug,
    });

    // -------------------------------------------------------------------------
    // 2. Fetch Logic for REPORTS (Paginated)
    // -------------------------------------------------------------------------

    const {
        data: reportsData,
        isLoading: loadingReports,
        error: errorReports
    } = useQuery({
        queryKey: ['reports', orgSlug, progSlug, currentPage, accessToken],
        queryFn: () => {
            if (!orgSlug || !progSlug) throw new Error(t('manageReports.invalidParameters'));
            return reportService.getReportsByProgram(
                accessToken,
                orgSlug,
                progSlug,
                currentPage,
                LIMIT,
                setAccessToken
            );
        },
        enabled: !!orgSlug && !!progSlug,
        // This keeps the previous page data visible while fetching the next page
        placeholderData: keepPreviousData,
    });

    // -------------------------------------------------------------------------
    // 3. Derived State & Handlers
    // -------------------------------------------------------------------------

    // Extract data safely
    const reports = reportsData?.reports || [];
    const totalCount = reportsData?.total || 0;
    const totalPages = Math.ceil(totalCount / LIMIT);

    const handlePrevPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    };

    const handleNextPage = () => {
        // Prevent going beyond calculated total pages
        if (!reportsData) return;
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    };

    // Combine loading/error states for a unified UI experience
    // Note: With keepPreviousData, isPlaceholderData is true during background fetch
    const isLoadingCombined = loadingReports || loadingProgram;
    const errorCombined = errorReports || errorProgram;

    // -------------------------------------------------------------------------
    // 4. Render
    // -------------------------------------------------------------------------

    return (
        <div className="h-auto bg-gray-50 py-8">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-bold mb-6">
                    {t('manageReports.title')} {program ? program.name : (progSlug || 'Program')}
                </h1>

                <AsyncContent
                    loading={isLoadingCombined}
                    error={errorCombined}
                    data={reportsData} // Use the wrapper object or simple true check
                    minLoadingTime={300}
                >
                    {reports.length === 0 ? (
                        <div className="text-center py-10 px-6 bg-white shadow rounded-lg">
                            <p>{t('manageReports.noReports')}</p>
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
                                className="px-4 py-2 bg-white border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors"
                            >
                                {'<'}
                            </button>
                            <span>
                                {t('common.pagination.page')} {currentPage} {t('common.pagination.of')} {totalPages}
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
                </AsyncContent>
            </div>
        </div>
    );
};

export default ManageReportsPage;