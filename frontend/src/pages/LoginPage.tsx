// src/pages/LoginPage.tsx
import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { AsyncContent } from '../components/AsyncContent';
import authService from '../services/authService';
import userService from '../services/userService';

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
    
    // Ref to prevent double execution in React 18 Strict Mode
    const effectRan = useRef(false);

    // Optional message passed through navigation state
    const message = location.state?.message as string | undefined;

    // -------------------------------------------------------------------------
    // 1. Mutation (Login Logic)
    // -------------------------------------------------------------------------

    const { 
        mutate: processLogin, 
        isPending: isProcessing, 
        error 
    } = useMutation({
        mutationFn: async (code: string) => {
            // 1. Exchange code for access token
            const { access_token } = await authService.exchangeOAuthCode(code);
            
            // 2. Fetch full user profile using the new token
            // Note: We pass an empty callback () => {} because we handle state update in onSuccess
            const fullUser = await userService.getUserProfile(access_token, () => {});
            
            return { access_token, user: fullUser };
        },
        onSuccess: (data) => {
            // Update Auth Context
            login(data.access_token, data.user);
            
            // Clean URL (remove ?code=...)
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Navigate to dashboard
            navigate('/programs');
            toast.success('Welcome back!');
        },
        onError: (err: any) => {
            console.error("Login failed", err);
            const msg = err?.response?.data?.detail || "Failed to log in.";
            toast.error(msg);
        }
    });

    // -------------------------------------------------------------------------
    // 2. Effects & Handlers
    // -------------------------------------------------------------------------

    // Trigger login if 'code' is present in URL (OAuth callback)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const code = params.get('code');

        if (code && !effectRan.current) {
            effectRan.current = true;
            processLogin(code);
        }
    }, [location.search, processLogin]);

    const handleGoogleLogin = async () => {
        try {
            const url = await authService.getGoogleAuthUrl();
            window.location.href = url;
        } catch (error) {
            console.error("Failed to get auth URL", error);
            toast.error("Could not connect to Google Login.");
        }
    };

    // -------------------------------------------------------------------------
    // 3. Render
    // -------------------------------------------------------------------------

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

                {/* AsyncContent handles loading/error states within the card */}
                <AsyncContent
                    loading={isProcessing}
                    error={error}
                    data={true} // Always render children if not loading/error
                    minLoadingTime={500}
                >
                    {/* Optional Message */}
                    {message && !error && (
                        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                            <div className="flex">
                                <div className="ml-3">
                                    <p className="text-sm text-blue-700">{message}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Google OAuth sign-in button */}
                    <div className="mt-8">
                        <button
                            onClick={handleGoogleLogin}
                            disabled={isProcessing}
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
                </AsyncContent>
            </div>
        </div>
    );
};

export default LoginPage;