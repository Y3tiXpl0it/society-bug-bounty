// src/services/programService.ts
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";
import {
    type ProgramCreateData,
    type ProgramBulkUpdateData,
    type PaginatedPrograms,
    type ProgramDetail,
    type ProgramSummary,
} from "../types/programTypes";

/**
 * A service object encapsulating all API calls related to programs.
 */
const programService = {
    /**
     * Fetches the programs for the currently authenticated organization member.
     */
    getMyPrograms: async (
        accessToken: string | null,
        onTokenRefresh?: (newToken: string) => void
    ): Promise<ProgramSummary[]> => {
        return apiGet<ProgramSummary[]>("/programs/me", accessToken, onTokenRefresh);
    },

    /**
     * Creates a new program.
     */
    createProgram: async (
        accessToken: string | null,
        programData: ProgramCreateData,
        onTokenRefresh?: (newToken: string) => void
    ) => {
        return apiPost("/programs/", accessToken, programData, onTokenRefresh);
    },

    /**
     * Deletes a program by its slugs.
     */
    deleteProgram: async (
        accessToken: string | null,
        orgSlug: string,
        progSlug: string,
        onTokenRefresh?: (newToken: string) => void
    ): Promise<void> => {
        return apiDelete(
            `/programs/${encodeURIComponent(orgSlug)}/${encodeURIComponent(progSlug)}`,
            accessToken,
            onTokenRefresh
        );
    },

    /**
     * Retrieves a single, detailed program by its slugs.
     */
    getProgramBySlug: async (
        accessToken: string | null,
        orgSlug: string,
        progSlug: string,
        onTokenRefresh?: (newToken: string) => void
    ): Promise<ProgramDetail> => {
        return apiGet<ProgramDetail>(
            `/programs/${encodeURIComponent(orgSlug)}/${encodeURIComponent(progSlug)}`,
            accessToken,
            onTokenRefresh
        );
    },

    /**
     * Performs a bulk update on a program's details, rewards, and assets.
     */
    bulkUpdate: async (
        accessToken: string | null,
        orgSlug: string,
        progSlug: string,
        data: ProgramBulkUpdateData,
        onTokenRefresh?: (newToken: string) => void
    ) => {
        return apiPatch(
            `/programs/${encodeURIComponent(orgSlug)}/${encodeURIComponent(progSlug)}`,
            accessToken,
            data,
            onTokenRefresh
        );
    },

    /**
     * Fetches a paginated list of all active programs.
     */
    getAllPrograms: async (
        accessToken: string | null,
        page: number = 1,
        limit: number = 10,
        onTokenRefresh?: (newToken: string) => void
    ): Promise<PaginatedPrograms> => {
        const skip = (page - 1) * limit;
        return apiGet(`/programs/?skip=${skip}&limit=${limit}`, accessToken, onTokenRefresh);
    },
};

export default programService;
