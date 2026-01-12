// frontend/src/services/attachmentService.ts
import { apiGet } from '../utils/apiClient';
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

const attachmentService = {
    getAttachmentsByReport,
    getAttachmentsByComment,
    getAttachmentsByProgram,
};

export default attachmentService;