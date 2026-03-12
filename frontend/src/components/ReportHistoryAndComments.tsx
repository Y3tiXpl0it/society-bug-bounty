// frontend/src/components/ReportHistoryAndComments.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';
import reportService from '../services/reportService';
import { type ReportEvent } from '../types/reportTypes';
import { type Asset } from '../types/programTypes';
import ReportHistory from './ReportHistory';
import MarkdownEditor from './MarkdownEditor';
import ConfirmationModal from './ConfirmationModal';
import { replaceDataUrlsInMarkdown } from '../utils/markdownUtils';
import attachmentService from '../services/attachmentService';
import { apiPatch } from '../utils/apiClient';
import { getErrorMessage } from '../utils/errorHelpers';
import { useMarkdownEditorWithAttachments } from '../hooks/useMarkdownEditorWithAttachments';
import toast from 'react-hot-toast';

interface ReportHistoryAndCommentsProps {
    reportId: string;
    reportDescription?: string;
    reportAssets?: Asset[];
    canComment?: boolean;
    showHistory?: boolean;
    refreshTrigger?: number;
    isProgramDeleted?: boolean;
}

const ReportHistoryAndComments: React.FC<ReportHistoryAndCommentsProps> = ({
    reportId,
    reportDescription,
    reportAssets,
    canComment = true,
    showHistory = true,
    refreshTrigger = 0,
    isProgramDeleted = false
}) => {
    const { t } = useTranslation();

    const commentSchema = z.object({
        content: z.string()
            .min(1, t('errors.COMMENT_CONTENT_EMPTY'))
            .max(10000, t('errors.COMMENT_CONTENT_TOO_LONG', { max_length: 10000 })),
        files: z.array(z.instanceof(File)).refine(
            (files) =>
                files.every((file) => {
                    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
                    return validTypes.includes(file.type) && file.name.length <= 255;
                }),
            t('errors.INVALID_FILE_TYPE_OR_NAME')
        ).optional(),
    });
    const [reportHistory, setReportHistory] = useState<ReportEvent[]>([]);
    const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
    const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
    const [commentError, setCommentError] = useState<string | null>(null);
    const { accessToken, setAccessToken } = useAuth();

    const [commentContent, setCommentContent] = useState<string>('');

    const {
        files: commentFiles,
        imageMap,
        fileError,
        setFiles: setCommentFiles,
        removeFile,
        handleFileChange,
        reset
    } = useMarkdownEditorWithAttachments();

    // Load report history on mount and when reportId changes
    useEffect(() => {
        const loadHistory = async () => {
            if (!reportId) return;

            setLoadingHistory(true);
            try {
                const history = await reportService.getReportHistory(accessToken, reportId, setAccessToken);
                console.log("Historial recibido:", history);
                setReportHistory(history);
            } catch (err) {
                console.error('Error loading report history:', err);
            } finally {
                setLoadingHistory(false);
            }
        };

        loadHistory();
    }, [reportId, refreshTrigger]);

    // Handle comment submission
    const handleCommentSubmit = async (formData: FormData) => {
        const content = formData.get('content') as string;
        const currentFiles: File[] = [];
        for (const [, value] of formData.entries()) {
            if (value instanceof File) {
                currentFiles.push(value);
            }
        }

        const result = commentSchema.safeParse({
            content: content.trim(),
            files: currentFiles.length > 0 ? currentFiles : undefined
        });
        if (!result.success) {
            setCommentError(result.error.issues.map((issue) => issue.message).join(', '));
            return;
        }
        setCommentError(null);
        setPendingFormData(formData);
        setShowConfirm(true);
    };

    const confirmSubmit = async () => {
        if (!pendingFormData) return;
        setShowConfirm(false);
        setIsSubmittingComment(true);
        try {
            const content = pendingFormData.get('content') as string;
            const files: File[] = [];
            for (const [, value] of pendingFormData.entries()) {
                if (value instanceof File) {
                    files.push(value);
                }
            }

            // Send FormData to backend via service
            const commentResponse = await reportService.addComment(accessToken, reportId, pendingFormData, setAccessToken);
            const commentId = commentResponse.id;

            // Replace filenames with real URLs in content for preview
            if (files.length > 0) {
                try {
                    const attachments = await attachmentService.getAttachmentsByComment(accessToken, reportId, commentId, setAccessToken);
                    if (files.length !== attachments.length) {
                        console.warn(`Mismatch: ${files.length} filenames vs ${attachments.length} attachments`);
                    }
                    const urlMap: Record<string, string> = {};
                    for (let i = 0; i < files.length && i < attachments.length; i++) {
                        const originalFilename = files[i].name;
                        const sanitizedFilename = originalFilename.replace(/ /g, '_');
                        const attachmentUrl = `${import.meta.env.VITE_API_BASE_URL}/reports/${reportId}/comments/${commentId}/attachments/${attachments[i].id}/download`;
                        urlMap[originalFilename] = attachmentUrl;
                        urlMap[sanitizedFilename] = attachmentUrl;
                    }

                    const updatedContent = replaceDataUrlsInMarkdown(content, urlMap);

                    const updatedData = {
                        content: updatedContent,
                    };

                    await apiPatch(`/reports/${reportId}/comments/${commentId}`, accessToken, updatedData, setAccessToken);
                } catch (replaceError) {
                    console.error('Error replacing data URLs:', replaceError);
                    // Continue anyway
                }
            }

            // Clear the comment content and files, and refresh the report history to show the new comment
            setCommentContent('');
            reset();
            setCommentError(null);
            try {
                const history = await reportService.getReportHistory(accessToken, reportId, setAccessToken);
                console.log("Historial recibido:", history);
                setReportHistory(history);
            } catch (err) {
                console.error('Error refreshing history:', err);
            }
        } catch (error) {
            console.error('Failed to submit comment:', error);
            const message = getErrorMessage(error);
            if (message !== null) toast.error(message);
        } finally {
            setIsSubmittingComment(false);
            setPendingFormData(null);
        }
    };

    const cancelSubmit = () => {
        setShowConfirm(false);
        setPendingFormData(null);
        setCommentError(null);
    };

    return (
        <div>
            {/* Report History */}
            {showHistory && (
                loadingHistory ? (
                    <div className="text-center p-8">{t('components.reportHistoryAndComments.loading')}</div>
                ) : (
                    <ReportHistory
                        reportHistory={reportHistory}
                        reportDescription={reportDescription}
                        reportAssets={reportAssets}
                        reportId={reportId}
                        accessToken={accessToken}
                    />
                )
            )}

            {/* Comment Editor */}
            {isProgramDeleted ? (
                <div className="p-6">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-md flex items-start">
                        <svg className="h-5 w-5 text-red-400 mt-0.5 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <h3 className="text-sm font-medium text-red-800">{t('components.reportHistoryAndComments.programArchivedTitle')}</h3>
                            <p className="mt-1 text-sm text-red-700">
                                {t('components.reportHistoryAndComments.programArchivedMsg')}
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                canComment && (
                    <div className="p-6">
                        <div className="border border-gray-300 rounded p-4 bg-white">
                            <MarkdownEditor
                                value={commentContent}
                                onChange={setCommentContent}
                                height={200}
                                files={commentFiles}
                                onFilesChange={setCommentFiles}
                                imageMap={imageMap}
                                label={t('components.reportHistoryAndComments.addCommentLabel')}
                                attachmentLabel="Attachments"
                                attachmentDescription="You can attach images (JPEG, JPG, PNG, WEBP) to support your comment."
                                showSubmitButton={true}
                                submitButtonText={t('components.reportHistoryAndComments.addCommentButton')}
                                onSubmit={handleCommentSubmit}
                                isSubmitting={isSubmittingComment}
                                onFileAdd={handleFileChange}
                                onFileRemove={removeFile}
                            />
                            {fileError && <div className="text-red-600 text-sm mt-1">{fileError}</div>}
                            {commentError && <div className="text-red-600 text-sm mt-1">{commentError}</div>}
                        </div>
                    </div>
                )
            )}

            <ConfirmationModal
                isOpen={showConfirm}
                title={t('components.reportHistoryAndComments.confirmTitle')}
                message={t('components.reportHistoryAndComments.confirmMsg')}
                onConfirm={confirmSubmit}
                onCancel={cancelSubmit}
                confirmText={t('components.reportHistoryAndComments.submitComment')}
                cancelText={t('common.actions.cancel')}
                isLoading={isSubmittingComment}
            />
        </div>
    );
};

export default ReportHistoryAndComments;