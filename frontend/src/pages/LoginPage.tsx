// src/pages/LoginPage.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { AsyncContent } from '../components/AsyncContent';
import authService from '../services/authService';
import userService from '../services/userService';

// Turnstile global type
declare global {
    interface Window {
        turnstile?: {
            render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
            reset: (widgetId: string) => void;
            remove: (widgetId: string) => void;
        };
    }
}

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

type LoginView = 'main' | 'guestLogin' | 'guestCredentials';

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
    const { t } = useTranslation();

    // Ref to prevent double execution in React 18 Strict Mode
    const effectRan = useRef(false);

    // State
    const [view, setView] = useState<LoginView>('main');
    const [guestCredentials, setGuestCredentials] = useState<{ username: string; password: string } | null>(null);
    const [guestUsername, setGuestUsername] = useState('');
    const [guestPassword, setGuestPassword] = useState('');
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Turnstile
    const turnstileRef = useRef<HTMLDivElement>(null);
    const turnstileWidgetId = useRef<string | null>(null);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

    // Optional message passed through navigation state
    const message = location.state?.message as string | undefined;

    // -------------------------------------------------------------------------
    // Turnstile Widget
    // -------------------------------------------------------------------------
    const renderTurnstile = useCallback(() => {
        if (turnstileRef.current && window.turnstile && !turnstileWidgetId.current) {
            turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
                sitekey: TURNSTILE_SITE_KEY,
                callback: (token: string) => setTurnstileToken(token),
                'expired-callback': () => setTurnstileToken(null),
                'error-callback': () => setTurnstileToken(null),
                theme: 'light',
            });
        }
    }, []);

    // Render Turnstile when view is 'main' and the script is loaded
    useEffect(() => {
        if (view === 'main') {
            // Small delay to ensure DOM is ready
            const timer = setTimeout(renderTurnstile, 100);
            return () => {
                clearTimeout(timer);
                if (turnstileWidgetId.current && window.turnstile) {
                    window.turnstile.remove(turnstileWidgetId.current);
                    turnstileWidgetId.current = null;
                }
            };
        }
    }, [view, renderTurnstile]);

    // -------------------------------------------------------------------------
    // 1. Mutation: Google OAuth Login
    // -------------------------------------------------------------------------
    const {
        mutate: processLogin,
        isPending: isProcessing,
        error
    } = useMutation({
        mutationFn: async (code: string) => {
            const { access_token } = await authService.exchangeOAuthCode(code);
            const fullUser = await userService.getUserProfile(access_token, () => { });
            return { access_token, user: fullUser };
        },
        onSuccess: (data) => {
            login(data.access_token, data.user);
            window.history.replaceState({}, document.title, window.location.pathname);
            navigate('/programs');
            toast.success(t('login.messages.success'));
        },
        onError: (err: any) => {
            console.error("Login failed", err);
            const msg = err?.response?.data?.detail || t('login.messages.error');
            toast.error(msg);
        }
    });

    // -------------------------------------------------------------------------
    // 2. Mutation: Create Guest Account
    // -------------------------------------------------------------------------
    const { mutate: createGuest, isPending: isCreatingGuest } = useMutation({
        mutationFn: async (token: string) => {
            return authService.createGuestAccount(token);
        },
        onSuccess: (data) => {
            setGuestCredentials(data.guest_credentials);
            setView('guestCredentials');
            toast.success(t('login.messages.guestSuccess'));
        },
        onError: (err: any) => {
            console.error("Guest creation failed", err);
            // Reset turnstile so user can retry
            if (turnstileWidgetId.current && window.turnstile) {
                window.turnstile.reset(turnstileWidgetId.current);
            }
            setTurnstileToken(null);
        }
    });

    // -------------------------------------------------------------------------
    // 3. Mutation: Guest Login
    // -------------------------------------------------------------------------
    const { mutate: loginAsGuest, isPending: isGuestLogging } = useMutation({
        mutationFn: async ({ username, password }: { username: string; password: string }) => {
            const data = await authService.guestLogin(username, password);
            const fullUser = await userService.getUserProfile(data.access_token, () => { });
            return { access_token: data.access_token, user: fullUser };
        },
        onSuccess: (data) => {
            login(data.access_token, data.user);
            navigate('/programs');
            toast.success(t('login.messages.guestLoginSuccess'));
        },
        onError: (err: any) => {
            console.error("Guest login failed", err);
        }
    });

    // -------------------------------------------------------------------------
    // 4. Effects & Handlers
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

    const { mutate: loginWithGoogle } = useMutation({
        mutationFn: authService.getGoogleAuthUrl,
        onSuccess: (url) => {
            window.location.href = url;
        },
        onError: () => {
            toast.error(t('login.messages.googleError'));
        }
    });

    const handleContinueAsGuest = () => {
        if (turnstileToken) {
            createGuest(turnstileToken);
        }
    };

    const handleCredentialsContinue = () => {
        // Force user to log in with their credentials to prove they saved them
        setView('guestLogin');
    };

    const handleCopy = async (text: string, field: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // -------------------------------------------------------------------------
    // 5. Render
    // -------------------------------------------------------------------------
    return (
        <div className="min-h-full flex items-center justify-center bg-gray-100 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">

                {/* --- VIEW: Main Login --- */}
                {view === 'main' && (
                    <>
                        <div className="text-center">
                            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                                {t('login.welcomeBack')}
                            </h2>
                            <p className="mt-2 text-sm text-gray-600">
                                {t('login.subtitle')}
                            </p>
                        </div>

                        <AsyncContent
                            loading={isProcessing}
                            error={error}
                            data={true}
                            minLoadingTime={500}
                        >
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
                                    onClick={() => loginWithGoogle()}
                                    disabled={isProcessing}
                                    className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 hover:cursor-pointer md:py-4 md:text-lg shadow-md transition-all duration-200"
                                >
                                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 1.78 1 3.34l3.57-2.77z" />
                                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.57 2.77c.84-2.54 3.28-4.46 6.25-4.46z" />
                                    </svg>
                                    {t('login.signInGoogle')}
                                </button>
                            </div>

                            {/* Divider */}
                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-300" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white text-gray-500">{t('login.or')}</span>
                                </div>
                            </div>

                            {/* Turnstile widget */}
                            <div className="flex justify-center mb-4">
                                <div ref={turnstileRef}></div>
                            </div>

                            {/* Continue as Guest button */}
                            <button
                                onClick={handleContinueAsGuest}
                                disabled={!turnstileToken || isCreatingGuest}
                                className="w-full flex items-center justify-center px-4 py-3 border-2 border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 hover:cursor-pointer md:py-4 md:text-lg shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isCreatingGuest ? (
                                    <svg className="animate-spin h-5 w-5 mr-3 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                )}
                                {t('login.continueAsGuest')}
                            </button>

                            {/* Guest Login link */}
                            <div className="text-center mt-4">
                                <button
                                    onClick={() => setView('guestLogin')}
                                    className="text-sm text-indigo-600 hover:text-indigo-500 hover:underline hover:cursor-pointer"
                                >
                                    {t('login.guestLogin')}
                                </button>
                            </div>
                        </AsyncContent>
                    </>
                )}

                {/* --- VIEW: Guest Login Form --- */}
                {view === 'guestLogin' && (
                    <>
                        <div className="text-center">
                            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                                {t('login.guestLogin')}
                            </h2>
                            <p className="mt-2 text-sm text-gray-600">
                                {t('login.guestLoginSubtitle')}
                            </p>
                        </div>

                        <form
                            className="mt-8 space-y-4"
                            onSubmit={(e) => {
                                e.preventDefault();
                                loginAsGuest({ username: guestUsername, password: guestPassword });
                            }}
                        >
                            <input
                                type="text"
                                placeholder={t('login.usernamePlaceholder')}
                                value={guestUsername}
                                onChange={(e) => setGuestUsername(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                required
                            />
                            <input
                                type="password"
                                placeholder={t('login.passwordPlaceholder')}
                                value={guestPassword}
                                onChange={(e) => setGuestPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                required
                            />
                            <button
                                type="submit"
                                disabled={isGuestLogging || !guestUsername || !guestPassword}
                                className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 hover:cursor-pointer md:py-4 md:text-lg shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGuestLogging ? (
                                    <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : null}
                                {t('login.loginButton')}
                            </button>
                        </form>

                        <div className="text-center mt-4">
                            <button
                                onClick={() => setView('main')}
                                className="text-sm text-indigo-600 hover:text-indigo-500 hover:underline hover:cursor-pointer"
                            >
                                ← {t('login.backToLogin')}
                            </button>
                        </div>
                    </>
                )}

                {/* --- VIEW: Guest Credentials (shown once) --- */}
                {view === 'guestCredentials' && guestCredentials && (
                    <>
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
                                <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h2 className="mt-4 text-2xl font-bold text-gray-900">
                                {t('login.guestCredentials.title')}
                            </h2>
                            <p className="mt-2 text-sm text-red-600 font-medium">
                                {t('login.guestCredentials.warning')}
                            </p>
                        </div>

                        <div className="mt-6 space-y-4">
                            {/* Username */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <label className="block text-sm font-medium text-gray-500 mb-1">
                                    {t('login.guestCredentials.username')}
                                </label>
                                <div className="flex items-center justify-between">
                                    <code className="text-lg font-mono font-semibold text-gray-900">
                                        {guestCredentials.username}
                                    </code>
                                    <button
                                        onClick={() => handleCopy(guestCredentials.username, 'username')}
                                        className="text-indigo-600 hover:text-indigo-500 text-sm hover:cursor-pointer"
                                    >
                                        {copiedField === 'username' ? t('login.guestCredentials.copied') : '📋'}
                                    </button>
                                </div>
                            </div>

                            {/* Password */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <label className="block text-sm font-medium text-gray-500 mb-1">
                                    {t('login.guestCredentials.password')}
                                </label>
                                <div className="flex items-center justify-between">
                                    <code className="text-lg font-mono font-semibold text-gray-900">
                                        {guestCredentials.password}
                                    </code>
                                    <button
                                        onClick={() => handleCopy(guestCredentials.password, 'password')}
                                        className="text-indigo-600 hover:text-indigo-500 text-sm hover:cursor-pointer"
                                    >
                                        {copiedField === 'password' ? t('login.guestCredentials.copied') : '📋'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleCredentialsContinue}
                            className="w-full mt-6 flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 hover:cursor-pointer md:py-4 md:text-lg shadow-md transition-all duration-200"
                        >
                            {t('login.guestCredentials.continue')}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default LoginPage;