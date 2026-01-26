// src/pages/EditProgramPage.tsx
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import programService from '../services/programService';
import ProgramForm from '../components/ProgramForm';
import ConfirmationModal from '../components/ConfirmationModal';
import { AsyncContent } from '../components/AsyncContent';
import { type ProgramBulkUpdateData } from '../types/programTypes';

/**
 * Renders the page for editing an existing bug bounty program.
 * Refactored to use TanStack Query for standard data fetching and mutations.
 */
const EditProgramPage: React.FC = () => {
    const { orgSlug, progSlug } = useParams<{ orgSlug: string; progSlug: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [showConfirm, setShowConfirm] = useState(false);
    const { accessToken, setAccessToken } = useAuth();

    // -------------------------------------------------------------------------
    // 1. Data Fetching (Get Program Details)
    // -------------------------------------------------------------------------
    
    const { 
        data: initialData, 
        isLoading, 
        error 
    } = useQuery({
        queryKey: ['program', orgSlug, progSlug, accessToken],
        queryFn: () => {
            if (!orgSlug || !progSlug) throw new Error("Invalid parameters");
            return programService.getProgramBySlug(accessToken, orgSlug, progSlug, setAccessToken);
        },
        // Only run query if slugs are present
        enabled: !!orgSlug && !!progSlug, 
    });

    // -------------------------------------------------------------------------
    // 2. Mutation (Update Program)
    // -------------------------------------------------------------------------

    const { mutate: updateProgram, isPending: isUpdating } = useMutation({
        mutationFn: (data: ProgramBulkUpdateData) => 
            programService.bulkUpdate(accessToken, orgSlug!, progSlug!, data, setAccessToken),
        
        onSuccess: (updatedProgram) => {
            toast.success('Program updated successfully!');
            // Update the cache with the new data immediately
            queryClient.setQueryData(['program', orgSlug, progSlug, accessToken], updatedProgram);
            // Optionally invalidate to ensure freshness
            queryClient.invalidateQueries({ queryKey: ['programs'] });
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.detail || err?.message || 'Failed to update program.';
            toast.error(msg);
        }
    });

    // -------------------------------------------------------------------------
    // 3. Mutation (Delete Program)
    // -------------------------------------------------------------------------

    const { mutate: deleteProgram, isPending: isDeleting } = useMutation({
        mutationFn: () => 
            programService.deleteProgram(accessToken, orgSlug!, progSlug!, setAccessToken),
        
        onSuccess: () => {
            // Close modal only after successful deletion
            setShowConfirm(false);
            
            toast.success('Program deleted.');
            
            // Invalidate lists so the deleted program is removed from views
            queryClient.invalidateQueries({ queryKey: ['programs'] });
            queryClient.invalidateQueries({ queryKey: ['myPrograms'] });
            
            navigate('/programs');
        },
        onError: (err: any) => {
            // Keep modal open so user can see error and retry
            const msg = err?.response?.data?.detail || err?.message || 'Failed to delete program.';
            toast.error(msg);
        }
    });

    // -------------------------------------------------------------------------
    // 4. Handlers
    // -------------------------------------------------------------------------

    // Marked as async to satisfy ProgramForm onSubmit type (Promise<void>)
    const handleUpdate = async (formData: any) => {
        updateProgram(formData);
    };

    const handleDelete = () => {
        setShowConfirm(true);
    };
    
    const confirmDelete = () => {
        // Trigger mutation; modal closing is handled in onSuccess
        deleteProgram();
    };

    const cancelDelete = () => {
        setShowConfirm(false);
    };

    // -------------------------------------------------------------------------
    // 5. Render
    // -------------------------------------------------------------------------

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                
                {/* AsyncContent handles loading/error states for the initial fetching */}
                <AsyncContent
                    loading={isLoading}
                    error={error}
                    data={initialData}
                    minLoadingTime={300}
                >
                    {initialData && (
                        <>
                            {/* Page Title */}
                            <h1 className="text-3xl font-bold mb-6 grid grid-cols-[auto,1fr] items-baseline gap-x-2">
                                <span>Edit Program:</span>
                                <span className="text-indigo-600 min-w-0 break-words">{initialData.name}</span>
                            </h1>

                            <ProgramForm
                                onSubmit={handleUpdate}
                                initialData={initialData}
                                isSubmitting={isUpdating || isDeleting}
                                submitButtonText="Save Changes"
                                renderExtraActions={() => (
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        disabled={isUpdating || isDeleting}
                                        className="bg-red-600 text-white hover:bg-red-700 px-6 py-2 rounded-md font-bold disabled:bg-gray-400 cursor-pointer"
                                    >
                                        {isDeleting ? 'Deleting...' : 'Delete Program'}
                                    </button>
                                )}
                            />
                        </>
                    )}
                </AsyncContent>

                <ConfirmationModal
                    isOpen={showConfirm}
                    title="Confirm Program Deletion"
                    message="Are you sure you want to permanently delete this program? This action cannot be undone."
                    onConfirm={confirmDelete}
                    onCancel={cancelDelete}
                    confirmText="Delete Program"
                    cancelText="Cancel"
                    isLoading={isDeleting}
                />
            </div>
        </div>
    );
};

export default EditProgramPage;