// frontend/src/utils/apiClient.ts

import axios from 'axios';
import type { AxiosResponse, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- Interfaces ---

/**
 * Standard Axios configuration with optional custom properties.
 * We extend AxiosRequestConfig to allow all standard axios options (data, params, withCredentials, etc.).
 */
export interface ApiOptions extends AxiosRequestConfig {
    // You can add custom properties here if needed in the future.
}

/**
 * Extended interface for INTERNAL axios config (used in interceptors).
 * In Axios v1+, InternalAxiosRequestConfig has strict 'headers' (AxiosHeaders class).
 */
interface ExtendedInternalAxiosRequestConfig extends InternalAxiosRequestConfig {
    onTokenRefresh?: (newToken: string) => void;
    _retry?: boolean;
}

/**
 * Interface for creating the request configuration (INPUT).
 * We use AxiosRequestConfig because it allows 'headers' to be a simple object (Record<string, string>),
 * which avoids TypeScript errors when merging headers manually.
 */
interface CreateRequestConfig extends AxiosRequestConfig {
    onTokenRefresh?: (newToken: string) => void;
}

// --- Global State for Token Refresh ---
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/**
 * Helper to get cookie value by name (used for extracting CSRF token).
 */
function getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

// --- Axios Instance ---
const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // 30 seconds timeout
    headers: {
        'Content-Type': 'application/json',
    },
});

// --- Token Refresh Logic ---
async function refreshAccessToken(): Promise<string | null> {
    const csrfToken = getCookie('XSRF-TOKEN');

    if (!csrfToken) {
        return null;
    }

    try {
        // We use a direct axios call to avoid interceptor loops
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, null, {
            withCredentials: true, // Send SBB_refresh cookie
            headers: {
                'X-XSRF-TOKEN': csrfToken,
            },
        });

        if (response.status >= 200 && response.status < 300) {
            return response.data.access_token;
        }
        return null;
    } catch (error) {
        console.error('Auto-refresh failed:', error);
        return null;
    }
}

// --- Interceptors ---

// Request Interceptor
instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // Config is already processed by Axios, so headers are AxiosHeaders instances.
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor (Handles 401 retries)
instance.interceptors.response.use(
    (response) => response,
    async (error) => {
        // Cast to our extended internal type to access _retry
        const originalRequest = error.config as ExtendedInternalAxiosRequestConfig;

        if (error.response?.status === 401 && !originalRequest._retry) {
            // Prevent infinite loops on the refresh endpoint itself
            if (originalRequest.url?.includes('/auth/refresh')) {
                return Promise.reject(error);
            }

            originalRequest._retry = true;

            if (isRefreshing) {
                // If refresh is already in progress, wait for it
                try {
                    const newToken = await refreshPromise;
                    if (newToken) {
                        // Update Authorization header safely for Internal config
                        if (originalRequest.headers instanceof axios.AxiosHeaders) {
                            originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
                        } else {
                            // Fallback for older axios versions or mocked tests
                            (originalRequest.headers as any)['Authorization'] = `Bearer ${newToken}`;
                        }
                        return instance(originalRequest);
                    }
                } catch (e) {
                    return Promise.reject(error);
                }
            } else {
                // Start new refresh process
                isRefreshing = true;
                refreshPromise = refreshAccessToken();

                try {
                    const newToken = await refreshPromise;
                    if (newToken) {
                        // Notify app state if callback provided
                        if (originalRequest.onTokenRefresh) {
                            originalRequest.onTokenRefresh(newToken);
                        }

                        // Update header and retry
                        if (originalRequest.headers instanceof axios.AxiosHeaders) {
                            originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
                        } else {
                            (originalRequest.headers as any)['Authorization'] = `Bearer ${newToken}`;
                        }

                        return instance(originalRequest);
                    }
                } catch (refreshError) {
                    console.error('Token refresh logic error:', refreshError);
                } finally {
                    isRefreshing = false;
                    refreshPromise = null;
                }
            }
        }

        return Promise.reject(error);
    }
);

// --- Main API Function ---

/**
 * Wrapper around axios to handle auth tokens and simplify usage.
 * * @param endpoint The API endpoint (relative or absolute)
 * @param token The access token (JWT)
 * @param options Axios configuration options (headers, params, data, withCredentials, etc.)
 * @param onTokenRefresh Callback for when token is refreshed automatically
 */
export const apiFetch = async <T = any>(
    endpoint: string,
    token: string | null,
    options: AxiosRequestConfig = {}, // Public type: allows simple object headers
    onTokenRefresh?: (newToken: string) => void
): Promise<AxiosResponse<T>> => {
    const fullUrl = endpoint.startsWith('http') ? endpoint : endpoint;

    // 1. Prepare Configuration
    // We use CreateRequestConfig (based on AxiosRequestConfig) to allow
    // assigning simple objects to 'headers' without TypeScript errors.
    const config: CreateRequestConfig = {
        url: fullUrl,
        method: 'GET', // Default method
        ...options, // Spread standard axios options (data, params, etc.)
        onTokenRefresh,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers, // Merge simple object headers
        },
    };

    // 2. Inject Token if present
    if (token) {
        // Since we are in the "creation" phase (AxiosRequestConfig),
        // headers are simple objects, so we can assign directly.
        config.headers = {
            ...config.headers,
            Authorization: `Bearer ${token}`,
        };
    }

    try {
        // 3. Execute Request
        return await instance(config);
    } catch (error: any) {
        
        // 1. Network Errors (No Response)
        if (!error.response) {
            toast.error('Could not connect to the server. Check your connection.');
        }
        // 2. Server Errors (500+)
        else if (error.response.status >= 500) {
            toast.error('Internal server error. Try again later.');
        }
        
        // 3. Other Errors are handled in the calling service/page
        throw error;
    }
};

// --- Convenience Helpers ---

export const apiGet = <T>(url: string, token: string | null, onTokenRefresh?: (t: string) => void) =>
    apiFetch<T>(url, token, { method: 'GET' }, onTokenRefresh).then((r) => r.data);

export const apiPost = <T>(url: string, token: string | null, data: any, onTokenRefresh?: (t: string) => void) =>
    apiFetch<T>(url, token, { method: 'POST', data }, onTokenRefresh).then((r) => r.data);

export const apiPut = <T>(url: string, token: string | null, data: any, onTokenRefresh?: (t: string) => void) =>
    apiFetch<T>(url, token, { method: 'PUT', data }, onTokenRefresh).then((r) => r.data);

export const apiPatch = <T>(url: string, token: string | null, data: any, onTokenRefresh?: (t: string) => void) =>
    apiFetch<T>(url, token, { method: 'PATCH', data }, onTokenRefresh).then((r) => r.data);

export const apiDelete = <T>(url: string, token: string | null, onTokenRefresh?: (t: string) => void) =>
    apiFetch<T>(url, token, { method: 'DELETE' }, onTokenRefresh).then((r) => r.data);
