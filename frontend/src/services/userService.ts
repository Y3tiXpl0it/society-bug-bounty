// frontend/src/services/userService.ts
import { apiGet, apiPatch } from '../utils/apiClient';
import imageUploadService from '../utils/imageUploadService';
import type { AuthUser } from '../types/userTypes';

const getUserProfile = async (
    accessToken: string | null,
    onTokenRefresh?: (newToken: string) => void
): Promise<AuthUser> => {
    return apiGet('/users/me', accessToken, onTokenRefresh);
};

const updateUserDetails = async (
    accessToken: string | null,
    data: { username?: string; profile_info?: string },
    onTokenRefresh?: (newToken: string) => void
): Promise<AuthUser> => {
    return apiPatch('/users/me/details', accessToken, data, onTokenRefresh);
};

const uploadAvatar = async (
    accessToken: string | null,
    file: File,
    onTokenRefresh?: (newToken: string) => void
): Promise<{ avatar_url: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    // Use centralized upload service with Bearer token authentication and auto-refresh
    return imageUploadService.upload('/users/me/avatar', formData, accessToken, onTokenRefresh);
};

const userService = {
    getUserProfile,
    updateUserDetails,
    uploadAvatar,
};

export default userService;
