// src/pages/ManageProgramsPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import programService from '../services/programService';
import { type ProgramSummary } from '../types/programTypes';
import ManageProgramCard from '../components/ManageProgramCard';

/**
 * A page component for organization members to view and manage their bug bounty programs.
 */
const ManageProgramsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, accessToken, setAccessToken, isLoading: isAuthLoading } = useAuth();
    
    // Stores the list of programs retrieved from the API
    const [programs, setPrograms] = useState<ProgramSummary[]>([]);

    // Handles the asynchronous operation to fetch programs
    const { 
        execute: fetchPrograms, 
        loading, 
        error 
    } = useAsync(
        async () => {
            // Verifies if the user is a member of an organization
            const isOrgMember = user?.organizations && user.organizations.length > 0;
            if (!isOrgMember) {
                throw new Error('You must be a member of an organization to manage programs.');
            }

            // Requests the list of programs from the service
            return await programService.getMyPrograms(accessToken, setAccessToken);
        },
        {
            onSuccess: (data) => {
                setPrograms(data);
            },
        }
    );

    // Initiates the data fetch once authentication is confirmed
    useEffect(() => {
        if (!isAuthLoading && user) {
            fetchPrograms();
        }
    }, [isAuthLoading, user, accessToken]);

    // Navigates to the program creation page
    const handleCreateProgram = () => navigate('/create-program');
    
    // Navigates to the program editing page
    const handleEditProgram = (program: ProgramSummary) => {
        navigate(`/edit-program/${program.organization.slug}/${program.slug}`);
    };

    // Navigates to the reports view for a specific program
    const handleViewReports = (program: ProgramSummary) => {
        navigate(`/programs/${program.organization.slug}/${program.slug}/reports`);
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">Manage Your Programs</h1>
                    <button
                        onClick={handleCreateProgram}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-6 rounded-md shadow-md transition duration-300 h-9 flex items-center justify-center cursor-pointer"
                    >
                        Create New Program
                    </button>
                </div>

                {/* Displays a loading indicator while fetching data */}
                {(loading || isAuthLoading) && (
                     <div className="text-center p-8 text-gray-500">Loading programs...</div>
                )}

                {/* Displays an error message if the fetch fails */}
                {error && (
                    <div className="text-center text-red-600 bg-red-100 p-4 rounded-md border border-red-200 mb-6">
                        <p className="font-semibold">Error loading programs</p>
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {/* Renders the list of programs or an empty state message */}
                {!loading && !isAuthLoading && !error && (
                    programs.length === 0 ? (
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
                    )
                )}
            </div>
        </div>
    );
};

export default ManageProgramsPage;