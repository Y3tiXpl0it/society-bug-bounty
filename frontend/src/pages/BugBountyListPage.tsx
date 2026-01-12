// src/pages/BugBountyList.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAsync } from '../hooks/useAsync';
import ProgramCard from '../components/ProgramCard';
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

    // Effect to fetch programs once the component mounts.
    const { execute: loadPrograms, loading: isLoading, error } = useAsync(
        async () => {
             return await programService.getAllPrograms(accessToken, currentPage, LIMIT, setAccessToken);
        },
        {
            onSuccess: (data) => {
                setPrograms(data.programs);
                setTotalPages(Math.ceil(data.total / LIMIT));
            },
        }
    );

    // Load programs when component mounts or page changes
    useEffect(() => {
        loadPrograms();
    }, [accessToken, currentPage]);

    const handlePrevPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    };

    const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    };

    // --- Conditional Rendering ---
    if (isLoading) {
        return <div className="text-center p-8">Loading programs...</div>;
    }

    if (error) {
        return <div className="text-center text-red-600 bg-red-100 p-4 rounded-md">{error}</div>;
    }

    return (
        <div className="h-auto bg-gray-50 py-8">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-bold mb-6">Programs</h1>
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
            </div>
        </div>
    );
};

export default BugBountyList;
