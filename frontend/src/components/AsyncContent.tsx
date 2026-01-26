// src/components/AsyncContent.tsx
import React, { useState, useEffect } from 'react';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface AsyncContentProps<T> {
    /**
     * Pass TanStack's `isLoading` here.
     * Use `isLoading` (initial load) generally. 
     * If you want to block UI on refetch, pass `isFetching`.
     */
    loading: boolean;
    
    /**
     * Pass TanStack's `error` object here.
     */
    error: any;
    
    /**
     * Optional: Pass the data object. 
     * Used to determine if we strictly have no data during a loading state.
     */
    data?: T | null;
    
    /**
     * The actual content to render when successful.
     */
    children: React.ReactNode;
    
    /**
     * Custom loader component (optional).
     */
    loadingComponent?: React.ReactNode;
    
    /**
     * Minimum time (ms) to show the loader to prevent flickering (default: 300ms).
     */
    minLoadingTime?: number;
}

// ----------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------

const getErrorMessage = (error: any): string => {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error?.response?.data?.detail) return error.response.data.detail;
    if (error?.response?.data?.message) return error.response.data.message;
    if (error?.message) return error.message;
    return 'An unexpected error occurred.';
};

const isNetworkError = (error: any, isOffline: boolean): boolean => {
    if (isOffline) return true;
    if (error && typeof error === 'object') {
        if (error.code === 'ERR_NETWORK') return true;
        if (error.code === 'ECONNABORTED') return true;
        if (error.message === 'Network Error') return true;
        if (error.message && error.message.includes('Failed to fetch')) return true;
    }
    return false;
};

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------

export const AsyncContent = <T,>({
    loading,
    error,
    data,
    children,
    loadingComponent,
    minLoadingTime = 300,
}: AsyncContentProps<T>) => {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [showLoader, setShowLoader] = useState(false);

    // --- 1. Offline Detection ---
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

    // --- 2. Min Loading Time Logic (Anti-Flicker) ---
    // This ensures that if the loader appears, it stays for at least `minLoadingTime`
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        if (loading) {
            setShowLoader(true);
        } else {
            // If loading finishes, keep showing loader until min time passes
            timeout = setTimeout(() => {
                setShowLoader(false);
            }, minLoadingTime);
        }
        return () => clearTimeout(timeout);
    }, [loading, minLoadingTime]);


    // ----------------------------------------------------------------------
    // Render Logic
    // ----------------------------------------------------------------------

    // CASE A: Network/Offline Error
    if (isNetworkError(error, isOffline)) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center min-h-[30vh]">
                <div className="bg-yellow-50 text-yellow-800 p-6 rounded-lg max-w-lg border border-yellow-200 shadow-sm">
                    <svg className="w-12 h-12 mx-auto mb-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                    </svg>
                    <h3 className="text-lg font-bold mb-2">No Internet Connection</h3>
                    <p>Please check your network settings and try again.</p>
                </div>
                <button 
                    onClick={() => window.location.reload()} 
                    className="mt-6 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 cursor-pointer"
                >
                    Reload page
                </button>
            </div>
        );
    }

    // CASE B: Hard Loading (Initial Load with no data)
    // If we have data cached (from TanStack), we generally don't want to show the full page spinner.
    // showLoader handles the visual debouncing.
    const hasData = data !== undefined && data !== null; // Simple existence check
    const isHardLoading = loading && !hasData;

    if (isHardLoading && showLoader) {
        return loadingComponent ? (
            <>{loadingComponent}</>
        ) : (
            <div className="flex flex-col justify-center items-center p-12 min-h-[50vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
                <span className="text-gray-500 font-medium animate-pulse">Loading content...</span>
            </div>
        );
    }

    // CASE C: Waiting for minLoadingTime to finish (prevent flicker)
    // Even if data arrived fast, if we started the loader, we wait for the timer.
    if (isHardLoading && !showLoader) {
        return null; 
    }

    // CASE D: Server Error (with response)
    if (error) {
        const message = getErrorMessage(error);
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center min-h-[30vh]">
                <div className="bg-red-50 text-red-700 p-6 rounded-lg max-w-2xl border border-red-100 shadow-sm">
                    <svg className="w-12 h-12 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="text-lg font-bold mb-2">Something went wrong</h3>
                    <p>{message}</p>
                </div>
                <button 
                    onClick={() => window.location.reload()} 
                    className="mt-6 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 cursor-pointer"
                >
                    Try Again
                </button>
            </div>
        );
    }

    // CASE E: Success / Stale Data Display
    return <>{children}</>;
};