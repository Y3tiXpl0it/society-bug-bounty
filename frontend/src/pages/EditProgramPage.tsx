// src/pages/EditProgramPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import programService from '../services/programService';
import ProgramForm from '../components/ProgramForm';
import ConfirmationModal from '../components/ConfirmationModal';
import { AsyncContent } from '../components/AsyncContent';
import { type ProgramBulkUpdateData } from '../types/programTypes';

/**
 * Renders the page for editing an existing bug bounty program.
 * Refactored to use AsyncContent and optimized hooks, preserving original styles.
 */
const EditProgramPage: React.FC = () => {
    const { orgSlug, progSlug } = useParams<{ orgSlug: string; progSlug: string }>();
    const navigate = useNavigate();
    const [showConfirm, setShowConfirm] = useState(false);
    const { accessToken, setAccessToken } = useAuth();

    // -------------------------------------------------------------------------
    // 1. FETCH Logic (GET) - Load initial data
    // -------------------------------------------------------------------------
    
    const fetchProgramCall = useCallback(async () => {
        if (!orgSlug || !progSlug) throw new Error("Invalid parameters");
        return await programService.getProgramBySlug(accessToken, orgSlug, progSlug, setAccessToken);
    }, [accessToken, orgSlug, progSlug, setAccessToken]);

    const fetchOptions = useMemo(() => ({
        onError: (err: any) => {
             const message = err.response?.data?.detail || err.message || 'Failed to load program.';
             toast.error(message);
        }
    }), []);

    const { 
        data: initialData,
        loading: isLoading,
        execute: loadProgram,
        error
    } = useAsync(fetchProgramCall, fetchOptions);

    // -------------------------------------------------------------------------
    // 2. UPDATE Logic (PATCH) - Save changes
    // -------------------------------------------------------------------------

    const updateProgramCall = useCallback(async (data: ProgramBulkUpdateData) => {
        return await programService.bulkUpdate(accessToken, orgSlug!, progSlug!, data, setAccessToken);
    }, [accessToken, orgSlug, progSlug, setAccessToken]);

    const updateOptions = useMemo(() => ({
        onSuccess: () => toast.success('Program updated successfully!'),
        showToastError: true
    }), []);

    const { 
        loading: isSubmitting,
        execute: updateProgram 
    } = useAsync(updateProgramCall, updateOptions);

    // -------------------------------------------------------------------------
    // 3. DELETE Logic (DELETE) - Remove program
    // -------------------------------------------------------------------------

    const deleteProgramCall = useCallback(async () => {
        await programService.deleteProgram(accessToken, orgSlug!, progSlug!, setAccessToken);
    }, [accessToken, orgSlug, progSlug, setAccessToken]);

    const deleteOptions = useMemo(() => ({
        onSuccess: () => {
            toast.success('Program deleted.');
            navigate('/programs');
        },
        showToastError: true
    }), [navigate]);

    const { 
        loading: isDeleting,
        execute: deleteProgram 
    } = useAsync(deleteProgramCall, deleteOptions);

    // -------------------------------------------------------------------------
    // 4. Effects & Handlers
    // -------------------------------------------------------------------------

    useEffect(() => {
        loadProgram();
    }, [loadProgram]);

    const handleUpdate = async (formData: any) => {
        await updateProgram(formData);
    };

    const handleDelete = () => setShowConfirm(true);
    
    const confirmDelete = async () => {
        await deleteProgram();
        setShowConfirm(false);
    };

    const cancelDelete = () => setShowConfirm(false);

    // -------------------------------------------------------------------------
    // 5. Render
    // -------------------------------------------------------------------------

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                
                {/* AsyncContent handles loading/error states visually replacing the old manual if(isLoading) */}
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
                                isSubmitting={isSubmitting || isDeleting}
                                submitButtonText="Save Changes"
                                renderExtraActions={() => (
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        disabled={isSubmitting || isDeleting}
                                        // Restored exact classes from original (removed transition-colors)
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