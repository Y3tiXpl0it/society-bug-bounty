// src/pages/EditProgramPage.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import programService from '../services/programService';
import ProgramForm from '../components/ProgramForm';
import ConfirmationModal from '../components/ConfirmationModal';
import { AsyncContent } from '../components/AsyncContent';
import { type ProgramBulkUpdateData } from '../types/programTypes';
import { showErrorToast } from '../utils/errorHandler';

/**
 * Renders the page for editing an existing bug bounty program.
 * Refactored to use TanStack Query for standard data fetching and mutations.
 */
const EditProgramPage: React.FC = () => {
    const { orgSlug, progSlug } = useParams<{ orgSlug: string; progSlug: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
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
            toast.success(t('editProgram.successUpdate'));
            // Update the cache with the new data immediately
            queryClient.setQueryData(['program', orgSlug, progSlug, accessToken], updatedProgram);
            // Optionally invalidate to ensure freshness
            queryClient.invalidateQueries({ queryKey: ['programs'] });
        },
        onError: (err: any) => {
            showErrorToast(err, t('editProgram.errorUpdate'));
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

            toast.success(t('editProgram.successDelete'));

            // Invalidate lists so the deleted program is removed from views
            queryClient.invalidateQueries({ queryKey: ['programs'] });
            queryClient.invalidateQueries({ queryKey: ['myPrograms'] });

            navigate('/programs');
        },
        onError: (err: any) => {
            showErrorToast(err, t('editProgram.errorDelete'));
        }
    });

    // -------------------------------------------------------------------------
    // 4. Handlers
    // -------------------------------------------------------------------------

    // Marked as async to satisfy ProgramForm onSubmit type (Promise<void>)
    const handleUpdate = async (formData: any) => {
        if (!isUpdating) {
            updateProgram(formData);
        }
    };

    const handleDelete = () => {
        setShowConfirm(true);
    };

    const confirmDelete = () => {
        if (!isDeleting) {
            deleteProgram();
        }
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
                                <span>{t('editProgram.title')}</span>
                                <span className="text-indigo-600 min-w-0 break-words">{initialData.name}</span>
                            </h1>

                            <ProgramForm
                                onSubmit={handleUpdate}
                                initialData={initialData}
                                isSubmitting={isUpdating || isDeleting}
                                submitButtonText={t('editProgram.submitButton')}
                                renderExtraActions={() => (
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        disabled={isUpdating || isDeleting}
                                        className="bg-red-600 text-white hover:bg-red-700 px-6 py-2 rounded-md font-bold disabled:bg-gray-400 cursor-pointer"
                                    >
                                        {isDeleting ? t('editProgram.deleting') : t('editProgram.deleteButton')}
                                    </button>
                                )}
                            />
                        </>
                    )}
                </AsyncContent>

                <ConfirmationModal
                    isOpen={showConfirm}
                    title={t('editProgram.confirmDeleteTitle')}
                    message={t('editProgram.confirmDeleteMessage')}
                    onConfirm={confirmDelete}
                    onCancel={cancelDelete}
                    confirmText={t('common.actions.delete')}
                    cancelText={t('common.actions.cancel')}
                    isLoading={isDeleting}
                />
            </div>
        </div>
    );
};

export default EditProgramPage;