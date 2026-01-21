// src/pages/BugBountyList.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useAsync } from '../hooks/useAsync';
import ProgramCard from '../components/ProgramCard';
import { AsyncContent } from '../components/AsyncContent';
import programService from '../services/programService';
import { type ProgramSummary } from '../types/programTypes';

/**
 * Renders the public-facing list of all active bug bounty programs.
 * This page fetches data from a public API endpoint.
 */
const BugBountyList: React.FC = () => {
    // --- Component State ---
    const [programs, setPrograms] = useState<ProgramSummary[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const { accessToken, setAccessToken } = useAuth();

    const LIMIT = 10; // Number of programs to fetch per page.

    // -------------------------------------------------------------------------
    // 1. Hook to fetch programs using useAsync (Memoized)
    // -------------------------------------------------------------------------
    
    // Define the fetch function with useCallback to prevent unnecessary re-renders
    const fetchProgramsData = useCallback(async () => {
        return await programService.getAllPrograms(accessToken, currentPage, LIMIT, setAccessToken);
    }, [accessToken, currentPage, setAccessToken]);

    // Define async options with useMemo
    const asyncOptions = useMemo(() => ({
        onSuccess: (data: any) => {
            setPrograms(data.programs);
            setTotalPages(Math.ceil(data.total / LIMIT));
        },
        onError: (err: any) => {
            const message = err.response?.data?.detail || err.response?.data?.message || err.message || 'Failed to load programs.';
            toast.error(message);
        }
    }), []);

    const { 
        execute: loadPrograms, 
        loading: isLoading, 
        error, 
        data 
    } = useAsync(fetchProgramsData, asyncOptions);

    // Load programs when component mounts or fetch dependency changes
    useEffect(() => {
        loadPrograms();
    }, [loadPrograms]);

    // -------------------------------------------------------------------------
    // 2. Event Handlers
    // -------------------------------------------------------------------------

    const handlePrevPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    };

    const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    };

    // -------------------------------------------------------------------------
    // 3. Render Logic
    // -------------------------------------------------------------------------

    return (
        <div className="h-auto bg-gray-50 py-8">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-bold mb-6">Programs</h1>
                
                {/* Wrap content in AsyncContent to handle Loading, Error, and Network states automatically */}
                <AsyncContent
                    loading={isLoading}
                    error={error}
                    data={data}
                    minLoadingTime={300}
                    keepDataWhileLoading={false}
                >
                    {programs.length === 0 ? (
                        <div className="text-center py-10 px-6 bg-white shadow rounded-lg">
                            <p>No programs found.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {programs.map((program) => <ProgramCard key={program.id} program={program} />)}
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
                </AsyncContent>
            </div>
        </div>
    );
};

export default BugBountyList;