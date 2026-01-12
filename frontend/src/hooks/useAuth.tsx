// src/hooks/useAuth.tsx

import React, { createContext, useState, useEffect, useContext } from 'react';
import type { ReactNode } from 'react';
import authService from '../services/authService';
import userService from '../services/userService';
import type { AuthUser, AuthContextType } from '../types/userTypes';

// Create the context with an initial undefined value.
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * The AuthProvider component is a wrapper that provides authentication state
 * and functions to all its children. It should be placed at the root of the application.
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize auth on app load - try to restore session with refresh token
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                const newToken = await authService.refreshAccessToken();
                if (newToken) {
                    setAccessToken(newToken);
                    const userData = await userService.getUserProfile(newToken, setAccessToken);
                    setUser(userData);
                } else {
                }
            } catch (error) {
            }
            setIsLoading(false);
        };

        initializeAuth();
    }, []);

    /**
     * Sets the authentication state upon successful login.
     */
    const login = (token: string, userData: AuthUser) => {
        setAccessToken(token);
        setUser(userData);
    };

    /**
     * Logs the user out by revoking refresh token and clearing state.
     */
    const logout = async () => {
        try {
            await authService.logout(accessToken);
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            setUser(null);
            setAccessToken(null);
            window.location.href = '/login';
        }
    };

    /**
     * Refreshes the current user data from the backend.
     */
    const refreshUser = async () => {
        if (!accessToken) return;

        try {
            const userData = await userService.getUserProfile(accessToken, setAccessToken);
            setUser(userData);
        } catch (error) {
            console.error('Failed to refresh user data:', error);
        }
    };

    const value = {
        isLoggedIn: !!user && !!accessToken,
        user,
        accessToken,
        isLoading,
        login,
        logout,
        refreshUser,
        setAccessToken,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * A custom hook to easily access the AuthContext.
 * Throws an error if used outside of an AuthProvider.
 */
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
