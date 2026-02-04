// src/pages/BugBountyList.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import ProgramCard from '../components/ProgramCard';
import { AsyncContent } from '../components/AsyncContent';
import programService from '../services/programService';
import type { ProgramSummary } from '../types/programTypes';

// Hoist static JSX to avoid re-creation on every render
const NO_PROGRAMS_VIEW = (t: (key: string) => string) => (
    <div className="text-center py-10 px-6 bg-white shadow rounded-lg">
        <p>{t('programs.noPrograms')}</p>
    </div>
);

/**
 * Renders the public-facing list of all active bug bounty programs.
 * This page fetches data from a public API endpoint.
 */
const BugBountyList: React.FC = () => {
    // --- Component State ---
    // Only UI state (current page) is needed locally; data state is managed by React Query.
    const [currentPage, setCurrentPage] = useState(1);
    const { accessToken, setAccessToken } = useAuth();
    const { t } = useTranslation();

    const LIMIT = 10;

    // -------------------------------------------------------------------------
    // 1. Data Fetching (TanStack Query)
    // -------------------------------------------------------------------------

    const {
        data,
        isLoading,
        error,
        isPlaceholderData
    } = useQuery({
        // Unique key for caching: refetches automatically when page or token changes
        queryKey: ['programs', currentPage, accessToken],

        // Fetcher function
        queryFn: () => programService.getAllPrograms(accessToken, currentPage, LIMIT, setAccessToken),

        // Keeps the previous page data visible while the new page is being fetched in the background
        placeholderData: keepPreviousData,
    });

    // -------------------------------------------------------------------------
    // 2. Derived Data
    // -------------------------------------------------------------------------

    // Safely extract data or default to empty values
    const programs = data?.programs || [];
    const totalPages = data?.total ? Math.ceil(data.total / LIMIT) : 0;

    // -------------------------------------------------------------------------
    // 3. Event Handlers
    // -------------------------------------------------------------------------

    const handlePrevPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    };

    const handleNextPage = () => {
        // Prevent navigation if we are already fetching the next page or reached the end
        if (!isPlaceholderData && currentPage < totalPages) {
            setCurrentPage((prev) => prev + 1);
        }
    };

    // -------------------------------------------------------------------------
    // 4. Render Logic
    // -------------------------------------------------------------------------

    return (
        <div className="h-auto bg-gray-50 py-8">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-bold mb-6">{t('programs.title')}</h1>

                <AsyncContent
                    loading={isLoading}
                    error={error}
                    data={data}
                    minLoadingTime={300}
                >
                    {programs.length === 0 ? (
                        NO_PROGRAMS_VIEW(t)
                    ) : (
                        // Apply opacity transition when background fetching occurs (isPlaceholderData is true)
                        <div className={`space-y-4 transition-opacity duration-200 ${isPlaceholderData ? 'opacity-50' : 'opacity-100'}`}>
                            {programs.map((program: ProgramSummary) => (
                                <ProgramCard key={program.id} program={program} />
                            ))}
                        </div>
                    )}

                    {/* --- Pagination Controls --- */}
                    {totalPages > 1 ? (
                        <div className="flex justify-center items-center mt-8 space-x-4">
                            <button
                                onClick={handlePrevPage}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-white border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors"
                            >
                                {'<'}
                            </button>
                            <span>
                                {t('programs.pagination.page')} {currentPage} {t('programs.pagination.of')} {totalPages}
                            </span>
                            <button
                                onClick={handleNextPage}
                                // Disable button if on last page or currently fetching next page data
                                disabled={currentPage === totalPages || isPlaceholderData}
                                className="px-4 py-2 bg-white border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors"
                            >
                                {'>'}
                            </button>
                        </div>
                    ) : null}
                </AsyncContent>
            </div>
        </div>
    );
};

export default BugBountyList;