// src/pages/CreateProgramPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import programService from '../services/programService';
import ProgramForm from '../components/ProgramForm';
import ConfirmationModal from '../components/ConfirmationModal';
import { AsyncContent } from '../components/AsyncContent';
import type { ProgramCreateData, ProgramBulkUpdateData } from '../types/programTypes';

/**
 * Renders the page for creating a new bug bounty program.
 * Refactored to use TanStack Query for standard data fetching and mutations.
 */
const CreateProgramPage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient(); // Optional: Used if you want to invalidate cache after create
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingFormData, setPendingFormData] = useState<ProgramCreateData | null>(null);
    const { accessToken, setAccessToken } = useAuth();

    // -------------------------------------------------------------------------
    // 1. Data Fetching (Get Organizations/My Programs)
    // -------------------------------------------------------------------------
    
    const { 
        data: organizations, 
        isLoading: loadingOrgs, 
        error: errorOrgs 
    } = useQuery({
        // Cache key: depends on token. If token changes, it refetches.
        queryKey: ['myPrograms', accessToken],
        queryFn: () => programService.getMyPrograms(accessToken, setAccessToken),
    });

    // -------------------------------------------------------------------------
    // 2. Mutation (Create Program)
    // -------------------------------------------------------------------------

    const { mutate: createProgram, isPending: isSubmitting } = useMutation({
        mutationFn: (newProgramData: ProgramCreateData) => 
            programService.createProgram(accessToken, newProgramData, setAccessToken),
        
        onSuccess: () => {
            setShowConfirm(false);
            setPendingFormData(null);

            toast.success('Program created successfully!');
            
            queryClient.invalidateQueries({ queryKey: ['programs'] });
            queryClient.invalidateQueries({ queryKey: ['myPrograms'] });
            
            navigate('/programs');
        },
        onError: (error: any) => {
            const msg = error?.response?.data?.message || 'Failed to create program';
            toast.error(msg);
        }
    });

    // -------------------------------------------------------------------------
    // 3. Handlers
    // -------------------------------------------------------------------------
    
    const handleCreateProgram = async (formData: ProgramCreateData | ProgramBulkUpdateData) => {
        setPendingFormData(formData as ProgramCreateData);
        setShowConfirm(true);
    };

    const confirmSubmit = () => {
        if (pendingFormData) {
            createProgram(pendingFormData);
        }
    };

    const cancelSubmit = () => {
        setShowConfirm(false);
        setPendingFormData(null);
    };

    // -------------------------------------------------------------------------
    // 4. Render
    // -------------------------------------------------------------------------
    
    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-bold mb-6">Create a New Program</h1>

                {/* AsyncContent handles loading/error for the initial data required to render the form */}
                <AsyncContent
                    loading={loadingOrgs}
                    error={errorOrgs}
                    data={organizations}
                    minLoadingTime={300}
                >
                    <ProgramForm
                        onSubmit={handleCreateProgram}
                        isSubmitting={isSubmitting}
                        submitButtonText="Create Program"
                    />
                </AsyncContent>

                <ConfirmationModal
                    isOpen={showConfirm}
                    title="Confirm Program Creation"
                    message="Are you sure you want to create this program?"
                    onConfirm={confirmSubmit}
                    onCancel={cancelSubmit}
                    confirmText="Create Program"
                    cancelText="Cancel"
                    isLoading={isSubmitting}
                />
            </div>
        </div>
    );
};

export default CreateProgramPage;