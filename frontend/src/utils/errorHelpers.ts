// frontend/src/utils/errorHelpers.ts
import axios from 'axios';

/**
 * Extracts a user-readable error message from any type of error.
 */
export const getErrorMessage = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
        // Priority: detail (FastAPI usually uses this) -> message -> status text
        const data = error.response?.data;
        
        if (data && typeof data === 'object') {
            if ('detail' in data) return String(data.detail);
            if ('message' in data) return String(data.message);
            // If the backend returns a validation errors object (e.g.: { email: "invalid" })
            if ('errors' in data) return Object.values(data.errors).join(', ');
        }
        
        return error.message || 'A network error occurred.';
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'An unexpected error occurred.';
};