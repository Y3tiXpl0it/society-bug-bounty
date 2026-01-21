// frontend/src/pages/ReportSubmitPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useAsync } from '../hooks/useAsync'; // Centralized hook
import { AsyncContent } from '../components/AsyncContent';
import programService from '../services/programService';
import attachmentService from '../services/attachmentService'; // Restored
import ReportSubmitForm from '../components/ReportForm';
import ConfirmationModal from '../components/ConfirmationModal';
import { apiPatch } from '../utils/apiClient'; // Restored
import imageUploadService from '../utils/imageUploadService';
import { replaceDataUrlsInMarkdown } from '../utils/markdownUtils';

// Default options for useAsync hooks
const DEFAULT_OPTIONS = {};

const ReportSubmitPage: React.FC = () => {
    const navigate = useNavigate();
    const { orgSlug, progSlug } = useParams<{ orgSlug: string; progSlug: string }>();
    const { accessToken, setAccessToken } = useAuth();

    // State to hold form data temporarily before confirmation
    const [pendingFormData, setPendingFormData] = useState<{
        formData: FormData;
        dataUrls: string[];
        filenames: string[];
    } | null>(null);

    const [showConfirm, setShowConfirm] = useState(false);

    // -------------------------------------------------------------------------
    // 1. Fetch Program Details (using useAsync)
    // -------------------------------------------------------------------------
    const getProgramData = useCallback(async () => {
        if (!orgSlug || !progSlug) throw new Error("Missing parameters");
        return await programService.getProgramBySlug(accessToken, orgSlug, progSlug, setAccessToken);
    }, [accessToken, orgSlug, progSlug, setAccessToken]);
    
    const { 
        data: program, 
        loading: isLoading, 
        error: fetchError,
        execute: fetchProgram 
    } = useAsync(getProgramData, DEFAULT_OPTIONS);

    useEffect(() => {
        fetchProgram();
    }, [fetchProgram]);

    // -------------------------------------------------------------------------
    // 2. Submit Logic (Restored original logic wrapped in useAsync)
    // -------------------------------------------------------------------------
    const { 
        execute: submitReport, 
        loading: isSubmitting 
    } = useAsync(
        async (data: { formData: FormData; filenames: string[] }) => {
            const { formData, filenames } = data;

            // Step 1: Upload the report with images embedded in FormData (POST)
            // This creates the report and uploads attachments in one go based on backend logic
            const result = await imageUploadService.upload(
                `/programs/${orgSlug}/${progSlug}/reports`,
                formData,
                accessToken,
                setAccessToken
            );

            // Step 2: If there are images, we need to fix the Markdown URLs
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
                    const updatedData = {
                        description: updatedDescription,
                    };

                    await apiPatch(`/reports/${result.id}`, accessToken, updatedData, setAccessToken);
                } catch (replaceError) {
                    console.error('Error replacing data URLs:', replaceError);
                    // We don't throw here to avoid failing the whole submission if just image replacement fails,
                    // but you could throw if strict consistency is required.
                }
            }
            return result;
        },
        {
            onSuccess: () => {
                toast.success('Report submitted successfully!');
                navigate(`/programs/${orgSlug}/${progSlug}`);
            },
        }
    );

    // --- Event Handlers ---

    const handleSubmitReport = async (formData: FormData, dataUrls: string[], filenames: string[]) => {
        // Store data and show confirmation modal
        setPendingFormData({ formData, dataUrls, filenames });
        setShowConfirm(true);
    };

    const confirmSubmit = async () => {
        if (pendingFormData && program) {
            // Execute the async operation
            await submitReport({ 
                formData: pendingFormData.formData, 
                filenames: pendingFormData.filenames 
            });
            setShowConfirm(false); 
        } else {
            toast.error('Missing form data or program info.');
        }
    };

    const cancelSubmit = () => {
        setShowConfirm(false);
        setPendingFormData(null);
    };

    // -------------------------------------------------------------------------
    // 3. Render Logic
    // -------------------------------------------------------------------------

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                
                <AsyncContent
                    loading={isLoading}
                    error={fetchError}
                    data={program}
                >
                    {program && (
                        <>
                            <h1 className="text-3xl font-bold mb-6">Submit a New Report</h1>
                            
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
                    title="Confirm Report Submission"
                    message="Are you sure you want to submit this report? Once submitted, it cannot be edited."
                    onConfirm={confirmSubmit}
                    onCancel={cancelSubmit}
                    confirmText="Submit Report"
                    cancelText="Cancel"
                    isLoading={isSubmitting}
                />
            </div>
        </div>
    );
};

export default ReportSubmitPage;