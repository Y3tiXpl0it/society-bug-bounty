// src/pages/EditProgramPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import programService from '../services/programService';
import ProgramForm from '../components/ProgramForm';
import ConfirmationModal from '../components/ConfirmationModal';
import { type ProgramBulkUpdateData } from '../types/programTypes';

/**
 * Renders the page for editing an existing bug bounty program.
 * This component acts as a "container" or "wrapper". It utilizes the generic
 * ProgramForm for the UI and state management, and is responsible for handling
 * the data fetching, updating, and deletion logic.
 */
const EditProgramPage: React.FC = () => {
    const { orgSlug, progSlug } = useParams<{ orgSlug: string; progSlug: string }>();
    const navigate = useNavigate();
    const [showConfirm, setShowConfirm] = useState(false);
    const { accessToken, setAccessToken } = useAuth();

    // Hooks to handle data fetching, updating, and deletion
    const { 
        data: initialData,
        loading: isLoading,
        execute: loadProgram,
        error
    } = useAsync(
        async () => {
            if (!orgSlug || !progSlug) throw new Error("Parámetros inválidos");
            return await programService.getProgramBySlug(accessToken, orgSlug, progSlug, setAccessToken);
        }
    );

    // Hook to handle program updates
    const { 
        loading: isSubmitting,
        execute: updateProgram 
    } = useAsync(
        async (data: ProgramBulkUpdateData) => {
            return await programService.bulkUpdate(accessToken, orgSlug!, progSlug!, data, setAccessToken);
        },
        {
            onSuccess: () => toast.success('Program updated successfully!')
        }
    );

    // Hook to handle program deletion
    const { 
        loading: isDeleting,
        execute: deleteProgram 
    } = useAsync(
        async () => {
            await programService.deleteProgram(accessToken, orgSlug!, progSlug!, setAccessToken);
        },
        {
            onSuccess: () => {
                toast.success('Program deleted.');
                navigate('/programs');
            }
        }
    );

    // Effect to load program data on mount
    useEffect(() => {
        if (accessToken && orgSlug && progSlug) {
            loadProgram();
        }
    }, [accessToken, orgSlug, progSlug]);

    // Event handlers
    const handleUpdate = async (formData: any) => {
        await updateProgram(formData);
    };

    const handleDelete = () => {
        setShowConfirm(true);
    };

    const confirmDelete = async () => {
        setShowConfirm(false);
        await deleteProgram();
    };

    const cancelDelete = () => {
        setShowConfirm(false);
    };

    // --- Conditional Render Logic ---
    if (isLoading) return <div className="text-center p-8">Loading program editor...</div>;
    if (error) return <div className="text-center text-red-600 bg-red-100 p-4 rounded-md">{error}</div>;

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Page Title */}
                <h1 className="text-3xl font-bold mb-6 grid grid-cols-[auto,1fr] items-baseline gap-x-2">
                    <span>Edit Program:</span>
                    <span className="text-indigo-600 min-w-0 break-words">{initialData?.name}</span>
                </h1>

                {/* Render the form only after initialData is loaded */}
                {initialData && (
                    <ProgramForm
                        onSubmit={handleUpdate}
                        initialData={initialData}
                        isSubmitting={isSubmitting || isDeleting}
                        submitButtonText="Save Changes"
                        // Pass the delete button as a render prop to the generic form
                        // because this action is unique to the edit page.
                        renderExtraActions={() => (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isSubmitting || isDeleting}
                                className="bg-red-600 text-white hover:bg-red-700 px-6 py-2 rounded-md font-bold disabled:bg-gray-400 cursor-pointer"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete Program'}
                            </button>
                        )}
                    />
                )}

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