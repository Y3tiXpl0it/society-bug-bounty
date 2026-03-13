// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App.tsx';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './hooks/useAuth.tsx';
import './i18n/config';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

if (!googleClientId) {
    throw new Error('Missing Google Client ID in .env file');
}

// Create the QueryClient instance outside of the render loop
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Retry failed requests only once (default is 3) for faster error feedback
            retry: 1,
            // Prevent automatic data refetching when the user switches tabs and returns
            refetchOnWindowFocus: false,
        },
    },
});

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        {/* Wrap the application with the QueryClientProvider */}
        <QueryClientProvider client={queryClient}>
            <GoogleOAuthProvider clientId={googleClientId}>
                <BrowserRouter>
                    <AuthProvider>
                        <App />
                    </AuthProvider>
                </BrowserRouter>
            </GoogleOAuthProvider>
        </QueryClientProvider>
    </StrictMode>,
);