// frontend/src/services/authService.ts

import { apiFetch } from '../utils/apiClient';
import type { AuthUser } from '../types/userTypes';

// Helper to get cookie value by name
function getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

// Gets Google OAuth authorization URL
const getGoogleAuthUrl = async (): Promise<string> => {
    const response = await apiFetch('/auth/google/authorize', null, {
        method: 'GET',
        withCredentials: true,
    });
    return response.data.authorization_url;
};

/**
 * Exchanges OAuth authorization code for access token
 */
const exchangeOAuthCode = async (code: string): Promise<{ access_token: string; user: AuthUser }> => {
    // Make API call to exchange code for token
    const response = await apiFetch('/auth/google/callback', null, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: { code },
        withCredentials: true,
    });

    return response.data;
};

/**
 * Refreshes access token using refresh token cookie
 */
const refreshAccessToken = async (): Promise<string | null> => {
    const csrfToken = getCookie('XSRF-TOKEN');

    if (!csrfToken) {
        return null;
    }

    try {
        const response = await apiFetch('/auth/refresh', null, {
            method: 'POST',
            withCredentials: true,
            headers: {
                'X-XSRF-TOKEN': csrfToken,
            },
        });

        if (response.status >= 200 && response.status < 300) {
            return response.data.access_token;
        }

        return null;
    } catch (error) {
        console.error('Token refresh failed:', error);
        return null;
    }
};

/**
 * Logs out by revoking refresh token
 */
const logout = async (accessToken: string | null): Promise<void> => {
    try {
        await apiFetch('/auth/logout', accessToken, {
            method: 'POST',
            withCredentials: true,
        });
    } catch (error) {
        console.error('Logout failed:', error);
        // Don't throw, proceed with local logout
    }
};

/**
 * Creates a new guest account (with Turnstile CAPTCHA verification)
 */
const createGuestAccount = async (turnstileToken: string): Promise<{
    access_token: string;
    guest_credentials: { username: string; password: string };
    user: AuthUser;
}> => {
    const response = await apiFetch('/auth/guest', null, {
        method: 'POST',
        data: { turnstile_token: turnstileToken },
        withCredentials: true,
    });
    return response.data;
};

/**
 * Logs in a guest user with username and password
 */
const guestLogin = async (username: string, password: string): Promise<{ access_token: string; user: AuthUser }> => {
    const response = await apiFetch('/auth/guest/login', null, {
        method: 'POST',
        data: { username, password },
        withCredentials: true,
    });
    return response.data;
};

const authService = {
    getGoogleAuthUrl,
    exchangeOAuthCode,
    refreshAccessToken,
    logout,
    createGuestAccount,
    guestLogin,
};

export default authService;
