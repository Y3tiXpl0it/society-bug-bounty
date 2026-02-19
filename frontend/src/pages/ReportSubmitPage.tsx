// src/pages/ReportSubmitPage.tsx
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { AsyncContent } from '../components/AsyncContent';
import programService from '../services/programService';
import attachmentService from '../services/attachmentService';
import ReportSubmitForm from '../components/ReportForm';
import ConfirmationModal from '../components/ConfirmationModal';
import { apiPatch } from '../utils/apiClient';
import imageUploadService from '../utils/imageUploadService';
import { replaceDataUrlsInMarkdown } from '../utils/markdownUtils';
import { showErrorToast } from '../utils/errorHandler';

/**
 * Renders the page for submitting a new vulnerability report.
 * Refactored to use TanStack Query and handle modal state based on mutation success.
 */
const ReportSubmitPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { orgSlug, progSlug } = useParams<{ orgSlug: string; progSlug: string }>();
    const { accessToken, setAccessToken } = useAuth();

    const [showConfirm, setShowConfirm] = useState(false);

    // State to hold form data temporarily before confirmation
    const [pendingFormData, setPendingFormData] = useState<{
        formData: FormData;
        filenames: string[];
    } | null>(null);

    // -------------------------------------------------------------------------
    // 1. Data Fetching (Get Program Details)
    // -------------------------------------------------------------------------

    const {
        data: program,
        isLoading,
        error
    } = useQuery({
        queryKey: ['program', orgSlug, progSlug, accessToken],
        queryFn: () => {
            if (!orgSlug || !progSlug) throw new Error("Missing parameters");
            return programService.getProgramBySlug(accessToken, orgSlug, progSlug, setAccessToken);
        },
        enabled: !!orgSlug && !!progSlug,
    });

    // -------------------------------------------------------------------------
    // 2. Mutation (Submit Report & Process Images)
    // -------------------------------------------------------------------------

    const { mutate: submitReport, isPending: isSubmitting } = useMutation({
        mutationFn: async (data: { formData: FormData; filenames: string[] }) => {
            const { formData, filenames } = data;

            // Step 1: Upload the report with images embedded in FormData (POST)
            const result = await imageUploadService.upload(
                `/programs/${orgSlug}/${progSlug}/reports`,
                formData,
                accessToken,
                setAccessToken
            );

            // Step 2: If there are images, fix the Markdown URLs
            if (filenames.length > 0) {
                try {
                    // Fetch the newly created attachments for this report
                    const attachments = await attachmentService.getAttachmentsByReport(
                        accessToken,
                        result.id.toString(),
                        setAccessToken
                    );

                    if (filenames.length !== attachments.length) {
                        console.warn(
                            `Mismatch: ${filenames.length} filenames vs ${attachments.length} attachments`
                        );
                    }

                    // Map original filenames to the new backend download URLs
                    const urlMap: Record<string, string> = {};
                    for (let i = 0; i < filenames.length && i < attachments.length; i++) {
                        const originalFilename = filenames[i];
                        const sanitizedFilename = originalFilename.replace(/ /g, '_');

                        // Construct the download URL
                        const attachmentUrl = `${import.meta.env.VITE_API_BASE_URL}/reports/${result.id}/attachments/${attachments[i].id}/download`;

                        urlMap[originalFilename] = attachmentUrl;
                        urlMap[sanitizedFilename] = attachmentUrl;
                    }

                    // Replace Base64 placeholders with real URLs in the description
                    const updatedDescription = replaceDataUrlsInMarkdown(result.description, urlMap);

                    // Step 3: Update the report with the fixed Markdown (PATCH)
                    await apiPatch(
                        `/reports/${result.id}`,
                        accessToken,
                        { description: updatedDescription },
                        setAccessToken
                    );

                    // Return the result with updated description just in case needed
                    return { ...result, description: updatedDescription };

                } catch (replaceError) {
                    console.error('Error replacing data URLs:', replaceError);

                    toast("Report submitted. However, image URL replacement failed.", {
                        icon: '⚠️',
                        duration: 5000,
                    });
                }
            }
            return result;
        },
        onSuccess: () => {
            // ONLY close the modal and navigate on success
            setShowConfirm(false);
            setPendingFormData(null);

            toast.success(t('reportSubmit.success'));
            navigate(`/programs/${orgSlug}/${progSlug}`);
        },
        onError: (err: any) => {
            showErrorToast(err, t('reportSubmit.error'));
        }
    });

    // -------------------------------------------------------------------------
    // 3. Handlers
    // -------------------------------------------------------------------------

    const handleSubmitReport = (formData: FormData, filenames: string[]) => {
        setPendingFormData({ formData, filenames });
        setShowConfirm(true);
    };

    const confirmSubmit = () => {
        if (pendingFormData) {
            submitReport(pendingFormData);
        } else {
            toast.error(t('reportSubmit.missingData'));
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

                <AsyncContent
                    loading={isLoading}
                    error={error}
                    data={program}
                    minLoadingTime={300}
                >
                    {program && (
                        <>
                            <h1 className="text-3xl font-bold mb-6">{t('reportSubmit.title')}</h1>

                            <ReportSubmitForm
                                onSubmit={handleSubmitReport}
                                isSubmitting={isSubmitting}
                                programName={program.name}
                                organizationName={program.organization.name}
                                assets={program.assets}
                            />
                        </>
                    )}
                </AsyncContent>

                <ConfirmationModal
                    isOpen={showConfirm}
                    title={t('reportSubmit.modals.confirmTitle')}
                    message={t('reportSubmit.modals.confirmMessage')}
                    onConfirm={confirmSubmit}
                    onCancel={cancelSubmit}
                    confirmText={t('reportSubmit.submitButton')}
                    cancelText={t('common.actions.cancel')}
                    isLoading={isSubmitting}
                />
            </div>
        </div>
    );
};

export default ReportSubmitPage;