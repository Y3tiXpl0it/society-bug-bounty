// frontend/src/services/attachmentService.ts
import { apiGet, apiFetch } from '../utils/apiClient';
import type { Attachment } from '../types/commonTypes';


const getAttachmentsByReport = async (
    accessToken: string | null,
    reportId: string,
    onTokenRefresh?: (newToken: string) => void
): Promise<Attachment[]> => {
    return apiGet<Attachment[]>(`/reports/${reportId}/attachments`, accessToken, onTokenRefresh);
};

const getAttachmentsByComment = async (
    accessToken: string | null,
    reportId: string,
    commentId: string,
    onTokenRefresh?: (newToken: string) => void
): Promise<Attachment[]> => {
    return apiGet<Attachment[]>(`/reports/${reportId}/comments/${commentId}/attachments`, accessToken, onTokenRefresh);
};

const getAttachmentsByProgram = async (
    accessToken: string | null,
    organizationSlug: string,
    programSlug: string,
    onTokenRefresh?: (newToken: string) => void
): Promise<Attachment[]> => {
    return apiGet<Attachment[]>(`/programs/${organizationSlug}/${programSlug}/attachments`, accessToken, onTokenRefresh);
};

const downloadAttachment = async (
    url: string,
    accessToken: string | null
): Promise<Blob> => {
    // We use apiFetch because we need to specify responseType: 'blob'
    // and we want the full response or just data (which is the blob)
    const response = await apiFetch<Blob>(url, accessToken, {
        method: 'GET',
        responseType: 'blob',
    });
    return response.data;
};

const attachmentService = {
    getAttachmentsByReport,
    getAttachmentsByComment,
    getAttachmentsByProgram,
    downloadAttachment,
};

export default attachmentService;