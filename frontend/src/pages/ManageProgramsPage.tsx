// src/pages/ManageProgramsPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import programService from '../services/programService';
import { type ProgramSummary } from '../types/programTypes';
import ManageProgramCard from '../components/ManageProgramCard';
import { AsyncContent } from '../components/AsyncContent';

/**
 * A page component for organization members to view and manage their bug bounty programs.
 * Refactored to use TanStack Query while preserving exact original styles.
 */
const ManageProgramsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, accessToken, setAccessToken, isLoading: isAuthLoading } = useAuth();
    
    // -------------------------------------------------------------------------
    // 1. Data Fetching (TanStack Query)
    // -------------------------------------------------------------------------

    const { 
        data, 
        isLoading: isLoadingPrograms, 
        error 
    } = useQuery({
        // Unique key for caching. Depends on the token.
        queryKey: ['myPrograms', accessToken],
        
        queryFn: async () => {
            // Verifies if the user is a member of an organization
            const isOrgMember = user?.organizations && user.organizations.length > 0;
            
            if (!isOrgMember) {
                // This error will be caught by AsyncContent via the error object
                throw new Error('You must be a member of an organization to manage programs.');
            }

            // Requests the list of programs from the service
            return await programService.getMyPrograms(accessToken, setAccessToken);
        },
        
        // Only run the query once the user authentication is resolved and user exists
        enabled: !isAuthLoading && !!user,
        
        // Optional: Keep data fresh for a bit, or refetch on window focus (defaults)
    });

    const programs = data || [];

    // -------------------------------------------------------------------------
    // 2. Handlers
    // -------------------------------------------------------------------------

    const handleCreateProgram = () => navigate('/create-program');
    
    const handleEditProgram = (program: ProgramSummary) => {
        navigate(`/edit-program/${program.organization.slug}/${program.slug}`);
    };

    const handleViewReports = (program: ProgramSummary) => {
        navigate(`/programs/${program.organization.slug}/${program.slug}/reports`);
    };

    // -------------------------------------------------------------------------
    // 3. Render
    // -------------------------------------------------------------------------

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">Manage Your Programs</h1>
                    <button
                        onClick={handleCreateProgram}
                        // Classes matched exactly to original
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-6 rounded-md shadow-md transition duration-300 h-9 flex items-center justify-center cursor-pointer"
                    >
                        Create New Program
                    </button>
                </div>

                {/* AsyncContent handles spinner and errors */}
                <AsyncContent
                    loading={isLoadingPrograms || isAuthLoading}
                    error={error}
                    data={programs}
                    minLoadingTime={300}
                >
                    {programs.length === 0 ? (
                        <div className="text-center py-10 px-6 bg-white shadow rounded-lg">
                            <p>You haven't created any programs yet. Start by creating one!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {programs.map((program) => (
                                <ManageProgramCard
                                    key={program.id}
                                    program={program}
                                    onEdit={() => handleEditProgram(program)}
                                    onViewReports={() => handleViewReports(program)}
                                />
                            ))}
                        </div>
                    )}
                </AsyncContent>
            </div>
        </div>
    );
};

export default ManageProgramsPage;