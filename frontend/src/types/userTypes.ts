// frontend/src/types/userTypes.ts
import type { Organization } from './commonTypes';

/**
 * Represents the nested 'details' object within the user data,
 * containing public profile information.
 */
export interface UserDetails {
    username: string;
    profile_info: string | null;
    avatar_url: string | null;
}

/**
 * Defines the structure of the authenticated user object, matching the backend response.
 */
export interface AuthUser {
    id: string;
    email: string;
    is_superuser: boolean;
    is_temporary: boolean;
    details: UserDetails | null; // User profile details are nested here.
    organizations: Organization[]; // A list of the user's organizations.
}

/**
 * Defines the shape of the data and actions provided by the AuthContext.
 */
export interface AuthContextType {
    isLoggedIn: boolean;
    user: AuthUser | null;
    accessToken: string | null;
    isLoading: boolean;
    login: (accessToken: string, userData: AuthUser) => void;
    logout: () => void;
    refreshUser: () => Promise<void>;
    setAccessToken: (token: string) => void;
}