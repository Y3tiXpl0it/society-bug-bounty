// frontend/src/utils/errorHelpers.ts
import axios from 'axios';

/**
 * Extracts a user-readable error message from any type of error.
 *
 * Returns null for structured backend errors ({ detail: { code, message } })
 * because apiClient already showed the translated toast for those.
 */
export const getErrorMessage = (error: unknown): string | null => {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data;

        if (data && typeof data === 'object') {
            if ('detail' in data) {
                const detail = data.detail;
                // Structured error: apiClient already handled it.
                if (detail && typeof detail === 'object' && 'code' in detail) {
                    return null;
                }
                // Plain-string detail
                if (typeof detail === 'string') return detail;
            }
            if ('message' in data) return String(data.message);
            if ('errors' in data) return Object.values(data.errors as Record<string, string>).join(', ');
        }

        return error.message || 'A network error occurred.';
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'An unexpected error occurred.';
};