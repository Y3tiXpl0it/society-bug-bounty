// frontend/src/pages/LoginPage.tsx
import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAsync } from '../hooks/useAsync';
import authService from '../services/authService';
import userService from '../services/userService';

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    const effectRan = useRef(false);

    // Optional message passed through navigation state (e.g., "Please log in first")
    const message = location.state?.message as string | undefined;

    // Use useAsync hook to handle the OAuth login process
    const { 
        execute: processLogin, 
        loading: isProcessing, 
        error 
    } = useAsync(
        async (code: string) => {
            // 1. Get access token and user data.
            const { access_token } = await authService.exchangeOAuthCode(code);

            // 2. Optionally, fetch full user profile if needed.
            const fullUser = await userService.getUserProfile(access_token, () => {});
            
            // 3. Return the data directly.
            return { access_token, user: fullUser };
        },
        {
            onSuccess: (data) => {
                login(data.access_token, data.user); 
                window.history.replaceState({}, document.title, window.location.pathname);
                navigate('/programs');
            },
        }
    );

    // Effect to handle OAuth callback on component mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const errorParam = params.get('error');

        // Handle errors from Google OAuth (e.g., user denied access)
        if (errorParam) {
            console.error('Google Auth Error:', errorParam);
            return;
        }

        // If authorization code is present and not already processed
        if (code && !isProcessing && !effectRan.current) {
            // Set flag to prevent multiple executions
            effectRan.current = true;

            processLogin(code);
        }
    }, []); // Run only on mount

    // Render loading state while authentication is in progress
    if (isProcessing) {
        return (
            <div className="min-h-full flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <h2 className="text-xl font-semibold text-gray-700">Authenticating...</h2>
                    <p className="text-gray-500">Please wait while we log you in.</p>
                </div>
            </div>
        );
    }

    // Render main login interface with Google sign-in button and error display
    return (
        <div className="min-h-full flex items-center justify-center bg-gray-100 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                        Welcome Back
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Sign in to access the Bug Bounty Platform
                    </p>
                </div>

                {/* Display optional redirect message if present */}
                {message && !error && (
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                        <div className="flex">
                            <div className="ml-3">
                                <p className="text-sm text-blue-700">{message}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Display authentication error from useAsync hook */}
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                        <div className="flex">
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">Authentication Failed</h3>
                                <p className="text-sm text-red-700 mt-1">{error}</p>
                                <p className="text-xs text-red-500 mt-2">
                                    Try logging in again. If the problem persists, contact support.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Google OAuth sign-in button */}
                <div className="mt-8">
                    <button
                        onClick={async () => {
                            // Fetch Google OAuth URL and redirect user to authenticate
                            try {
                                const url = await authService.getGoogleAuthUrl();
                                window.location.href = url;
                            } catch (e) {
                                console.error(e);
                                // Handle error by showing user feedback (e.g., toast notification)
                            }
                        }}
                        className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 hover:cursor-pointer md:py-4 md:text-lg shadow-md transition-all duration-200"
                    >
                        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                            <path
                                fill="currentColor"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="currentColor"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="currentColor"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 1.78 1 3.34l3.57-2.77z"
                            />
                            <path
                                fill="currentColor"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.57 2.77c.84-2.54 3.28-4.46 6.25-4.46z"
                            />
                        </svg>
                        Sign in with Google
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;