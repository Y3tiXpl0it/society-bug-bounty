import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
// Imports the custom hook to access authentication state and actions.
import { useAuth } from '../hooks/useAuth';
import NotificationDropdown from './NotificationDropdown';
import { useNotifications } from '../hooks/useNotifications';
import Avatar from 'boring-avatars';

import logoImage from '../assets/navbar_logo.png';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Navbar component provides consistent navigation across the application.
 * It is responsive and displays different options based on the user's
 * authentication status.
 */
const Navbar: React.FC = () => {
    // --- State and Context ---
    const { t } = useTranslation();
    const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const { isLoggedIn, isLoading, user, logout } = useAuth();
    const {
        notifications,
        unreadCount,
        loading: notificationsLoading,
        loadingMore,
        hasMore,
        markAllAsRead,
        loadMoreNotifications,
    } = useNotifications();

    // Effect to handle clicks outside the profile menu to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setProfileMenuOpen(false);
            }
        };

        if (isProfileMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isProfileMenuOpen]);

    // Derived state to check if the user belongs to any organization.
    // This is used to conditionally show organization-specific links.
    const isOrgMember = !!(user?.organizations && user.organizations.length > 0);

    /**
     * Renders the authentication section for the desktop view (md screens and up).
     * It handles loading, logged-in, and logged-out states.
     */
    const renderAuthButton = () => {
        // Display a loading skeleton while authentication status is being checked.
        if (isLoading) {
            return <div className="w-24 h-8 bg-gray-200 rounded-md animate-pulse"></div>;
        }

        // If the user is logged in, display the profile dropdown menu.
        if (isLoggedIn && user) {
            return (
                <div className="relative" ref={profileMenuRef}>
                    <button
                        onClick={() => setProfileMenuOpen(!isProfileMenuOpen)}
                        className="flex items-center justify-center w-10 h-10 rounded-full text-gray-600 border border-gray-300 hover:border-2 hover:border-indigo-700 focus:outline-none cursor-pointer"
                    >
                        {user.details?.avatar_url ? (
                            <img
                                src={`${API_BASE_URL}${user.details.avatar_url}`}
                                alt="Avatar"
                                className="w-10 h-10 rounded-full object-cover"
                            />
                        ) : (
                            <Avatar
                                size={40}
                                name={user.id}
                                variant="bauhaus"
                            />
                        )}
                    </button>
                    {isProfileMenuOpen && (
                        <div className="origin-top-right absolute right-0 mt-2 w-48 rounded shadow-lg py-1 bg-white border border-gray-300">
                            <Link to="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                {t('components.navbar.myProfile')}
                            </Link>
                            {/* Conditionally render the "Manage Programs" link for organization members. */}
                            {isOrgMember && (
                                <Link
                                    to="/manage-programs"
                                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    {t('components.navbar.managePrograms')}
                                </Link>
                            )}
                            <button
                                onClick={logout}
                                className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                            >
                                {t('components.navbar.logout')}
                            </button>
                        </div>
                    )}
                </div>
            );
        } else {
            // If the user is logged out, display a login button.
            return (
                <Link
                    to="/login"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md text-sm font-medium transition duration-300"
                >
                    {t('components.navbar.login')}
                </Link>
            );
        }
    };

    return (
        <nav className="bg-white shadow-md sticky top-0 z-50">
            <div className="w-full px-4 sm:px-6 lg:px-8">
                <div className="relative flex items-center justify-between h-16">

                    {/* Left side (Logo) */}
                    <div className="flex-shrink-0 z-10">
                        <Link to="/" className="flex items-center">
                            <img src={logoImage} alt="navbar-logo" className="h-10 w-auto object-contain" />
                        </Link>
                    </div>

                    {/* Center (Links) */}
                    <div className="absolute left-1/2 transform -translate-x-1/2">
                        <div className="flex items-baseline space-x-4">
                            <Link
                                to="/programs"
                                className="text-gray-600 hover:text-indigo-700 px-3 py-2 rounded-md text-sm font-medium"
                            >
                                {t('components.navbar.programs')}
                            </Link>
                            <Link
                                to="/leaderboard"
                                className="text-gray-600 hover:text-indigo-700 px-3 py-2 rounded-md text-sm font-medium"
                            >
                                {t('components.navbar.leaderboard')}
                            </Link>
                            {isLoggedIn && (
                                <Link
                                    to="/my-reports"
                                    className="text-gray-600 hover:text-indigo-700 px-3 py-2 rounded-md text-sm font-medium"
                                >
                                    {t('components.navbar.myReports')}
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Right side (Profile) */}
                    <div className="flex items-center space-x-4 z-10">
                        {/* Notifications */}
                        {isLoggedIn && (
                            <NotificationDropdown
                                notifications={notifications}
                                unreadCount={unreadCount}
                                loading={notificationsLoading}
                                loadingMore={loadingMore}
                                hasMore={hasMore}
                                onMarkAllAsRead={markAllAsRead}
                                onLoadMore={loadMoreNotifications}
                            />
                        )}
                        {/* Auth for Desktop */}
                        <div className="flex items-center">{renderAuthButton()}</div>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
