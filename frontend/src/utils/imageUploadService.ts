// frontend/src/utils/imageUploadService.ts

/**
 * Centralized service for handling image uploads in the frontend.
 * Provides a generic upload method that can be used for different types of image uploads.
 */

import { apiFetch } from './apiClient';

/**
 * Generic method to upload FormData to any endpoint with Bearer token authentication.
 * Handles the common HTTP upload logic including error handling, response parsing,
 * and automatic token refresh on 401 errors.
 *
 * @param endpoint - The API endpoint to upload to (e.g., '/users/me/avatar')
 * @param formData - The FormData containing the upload data
 * @param accessToken - The current access token (can be null)
 * @param onTokenRefresh - Callback to update token in app state when refreshed
 * @returns Promise resolving to the parsed JSON response
 * @throws Error with descriptive message on failure
 */
export const upload = async (
    endpoint: string,
    formData: FormData,
    accessToken: string | null,
    onTokenRefresh?: (newToken: string) => void
): Promise<any> => {
    try {
        const response = await apiFetch(
            endpoint,
            accessToken,
            {
                method: 'POST',
                data: formData,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            },
            onTokenRefresh
        );

        if (response.status < 200 || response.status >= 300) {
            const errorData = response.data || {};
            const errorMessage = errorData.detail || `HTTP error! Status: ${response.status}`;
            throw new Error(errorMessage);
        }

        return response.data;
    } catch (error) {
        // Re-throw with more context if it's already an Error
        if (error instanceof Error) {
            throw error;
        }
        // Handle network errors or other unexpected errors
        throw new Error('Upload failed due to network error');
    }
};

/**
 * Validates if a file is a valid image for upload.
 * Checks file type, size, and name length.
 *
 * @param file - The file to validate
 * @param maxSizeBytes - Maximum allowed file size in bytes (default: 10MB)
 * @returns true if valid, throws Error if invalid
 */
export const validateImageFile = (file: File, maxSizeBytes: number = 10 * 1024 * 1024): boolean => {
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
        throw new Error('Only image files are allowed');
    }

    // Check file size
    if (file.size > maxSizeBytes) {
        const maxSizeMB = maxSizeBytes / (1024 * 1024);
        throw new Error(`File size exceeds the maximum allowed limit of ${maxSizeMB} MB`);
    }

    // Check filename length
    if (file.name.length > 255) {
        throw new Error('File name is too long (maximum 255 characters)');
    }

    return true;
};

const imageUploadService = {
    upload,
    validateImageFile,
};

export default imageUploadService;
