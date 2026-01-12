// frontend/src/services/reportService.ts
import type { Report, ReportCreatePayload, PaginatedReportSummaryResponse, ReportMyReportsSummary, ReportEvent, ReportComment } from '../types/reportTypes';
import { apiGet, apiPost, apiPatch, apiFetch } from '../utils/apiClient';

const submitReport = async (
    accessToken: string | null,
    orgSlug: string,
    progSlug: string,
    reportData: ReportCreatePayload,
    onTokenRefresh?: (newToken: string) => void
): Promise<Report> => {
    return apiPost(`/programs/${orgSlug}/${progSlug}/reports`, accessToken, reportData, onTokenRefresh);
};

const getReportsByProgram = async (
    accessToken: string | null,
    orgSlug: string,
    progSlug: string,
    page: number = 1,
    limit: number = 10,
    onTokenRefresh?: (newToken: string) => void
): Promise<PaginatedReportSummaryResponse> => {
    const skip = (page - 1) * limit;
    return apiGet(`/programs/${orgSlug}/${progSlug}/reports?skip=${skip}&limit=${limit}`, accessToken, onTokenRefresh);
};

const getReportById = async (
    accessToken: string | null,
    reportId: string,
    onTokenRefresh?: (newToken: string) => void
): Promise<Report> => {
    return apiGet(`/reports/${reportId}`, accessToken, onTokenRefresh);
};

const updateReportStatus = async (
    accessToken: string | null,
    reportId: string,
    status: string,
    onTokenRefresh?: (newToken: string) => void
): Promise<Report> => {
    return apiPatch(`/reports/${reportId}/status`, accessToken, { status }, onTokenRefresh);
};

const updateReportSeverity = async (
    accessToken: string | null,
    reportId: string,
    severity: number,
    onTokenRefresh?: (newToken: string) => void
): Promise<Report> => {
    return apiPatch(`/reports/${reportId}/severity`, accessToken, { severity }, onTokenRefresh);
};

const getMyReports = async (
    accessToken: string | null,
    onTokenRefresh?: (newToken: string) => void
): Promise<ReportMyReportsSummary[]> => {
    return apiGet('/reports/me', accessToken, onTokenRefresh);
};

const getReportHistory = async (
    accessToken: string | null,
    reportId: string,
    onTokenRefresh?: (newToken: string) => void
): Promise<ReportEvent[]> => {
    return apiGet(`/reports/${reportId}/history`, accessToken, onTokenRefresh);
};

const addComment = async (
    accessToken: string | null,
    reportId: string,
    formData: FormData,
    onTokenRefresh?: (newToken: string) => void
): Promise<ReportComment> => {
    const response = await apiFetch(`/reports/${reportId}/comments`, accessToken, {
        method: 'POST',
        data: formData,
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    }, onTokenRefresh);

    return response.data;
};

const getReportComments = async (
    accessToken: string | null,
    reportId: string,
    onTokenRefresh?: (newToken: string) => void
): Promise<ReportComment[]> => {
    return apiGet(`/reports/${reportId}/comments`, accessToken, onTokenRefresh);
};

const reportService = {
    submitReport,
    getReportsByProgram,
    getReportById,
    updateReportStatus,
    updateReportSeverity,
    getMyReports,
    getReportHistory,
    addComment,
    getReportComments,
};

export default reportService;
