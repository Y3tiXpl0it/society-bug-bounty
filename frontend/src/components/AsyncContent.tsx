// src/components/AsyncContent.tsx
import React, { useState, useEffect } from 'react';

// ----------------------------------------------------------------------
// Helper Functions (Defined here to be self-contained)
// ----------------------------------------------------------------------

/**
 * Extracts a readable error message from various error objects (Axios, Error, string).
 */
const getErrorMessage = (error: any): string => {
    if (!error) return '';
    if (typeof error === 'string') return error;
    // Axios error response data
    if (error?.response?.data?.detail) return error.response.data.detail;
    if (error?.response?.data?.message) return error.response.data.message;
    // Standard Error object
    if (error?.message) return error.message;
    return 'An unexpected error occurred.';
};

/**
 * Robust check for network/offline errors.
 * Handles: Browser offline state, Axios 'ERR_NETWORK', 'ECONNABORTED', and fetch errors.
 */
const isNetworkError = (error: any, isOffline: boolean): boolean => {
    // 1. Browser API says we are offline
    if (isOffline) return true;
    
    // 2. Check Error Object properties
    if (error && typeof error === 'object') {
        // Axios v1.x+ specific code for network errors
        if (error.code === 'ERR_NETWORK') return true;
        // Connection aborted / timeout
        if (error.code === 'ECONNABORTED') return true;
        // Standard messages for fetch/axios
        if (error.message === 'Network Error') return true;
        if (error.message === 'Failed to fetch') return true;
        if (error.message && error.message.includes('Network request failed')) return true;
    }
    
    // 3. Fallback for string errors (legacy)
    if (typeof error === 'string') {
        return error === 'Network Error' || error === 'Failed to fetch';
    }
    
    return false;
};

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

interface AsyncContentProps<T> {
    /** Loading state coming from useAsync */
    loading: boolean;
    /** Error object or message coming from useAsync */
    error: any;
    /** The expected data (used to determine if content was previously loaded) */
    data: T | null | undefined;
    /** The actual content to render if everything is successful */
    children: React.ReactNode;
    /** Optional component to replace the default spinner (e.g., a custom Skeleton) */
    loadingComponent?: React.ReactNode;
    /** Minimum time in ms before showing the loader to avoid flickering (Default: 300ms) */
    minLoadingTime?: number;
    /** If true, keeps showing the old data while refetching (useful for background updates) */
    keepDataWhileLoading?: boolean;
}

export const AsyncContent = <T,>({ 
    loading, 
    error, 
    data, 
    children,
    loadingComponent,
    minLoadingTime = 300,
    keepDataWhileLoading = false
}: AsyncContentProps<T>) => {
    const [showLoader, setShowLoader] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    // 1. Detect network connection status
    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // 2. Smart Delay Logic ("Delayed Loading")
    useEffect(() => {
        // Use ReturnType to avoid 'NodeJS' namespace issues in frontend
        let timer: ReturnType<typeof setTimeout>;

        // Condition: Is loading AND (no data exists OR we don't want to keep old data)
        const shouldIndicateLoading = loading && (!data || !keepDataWhileLoading);

        if (shouldIndicateLoading) {
        // If loading starts, wait for the minimum time before showing the spinner
        timer = setTimeout(() => {
            setShowLoader(true);
        }, minLoadingTime);
        } else {
        // If loading finishes, hide the spinner immediately
        setShowLoader(false);
        }

        return () => clearTimeout(timer);
    }, [loading, data, keepDataWhileLoading, minLoadingTime]);

    // --- RENDERING ---

    // CASE A: Network Error (Offline)
    // We pass 'error' and 'isOffline' to our helper function
    if (error && isNetworkError(error, isOffline)) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 min-h-[50vh]">
                {/* Offline Icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900">No internet connection</h3>
                <p className="mt-2 text-sm text-gray-500 max-w-sm">
                    Unable to load data. Please check your network connection and try again.
                </p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="mt-6 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer"
                >
                    Reload page
                </button>
            </div>
        );
    }

    // CASE B: Loading (Slow) -> Show Loader
    if (loading && (!data || !keepDataWhileLoading) && showLoader) {
        return loadingComponent || (
            <div className="flex flex-col justify-center items-center p-12 min-h-[50vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
                <span className="text-gray-500 font-medium animate-pulse">Loading content...</span>
            </div>
        );
    }

    // CASE C: Loading (Fast) -> Invisible
    if (loading && (!data || !keepDataWhileLoading)) {
        return null; 
    }

    // CASE D: Server Error (Online)
    if (error) {
        const message = getErrorMessage(error);
        return (
        <div className="flex flex-col items-center justify-center p-8 text-center min-h-[30vh]">
            <div className="bg-red-50 text-red-700 p-6 rounded-lg max-w-2xl border border-red-100 shadow-sm">
                <h3 className="font-bold text-lg mb-2">Error loading data</h3>
                <p>{message}</p>
            </div>
        </div>
        );
    }

    // CASE E: Success
    return <>{children}</>;
};