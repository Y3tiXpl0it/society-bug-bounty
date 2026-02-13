// frontend/src/components/NotificationDropdown.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Notification } from '../types/notificationTypes';
import { NotificationRole } from '../types/notificationTypes';
import { getTranslatedStatus } from '../utils/statusHelper';
import { getTranslatedSeverity } from '../utils/severityHelper';

interface NotificationDropdownProps {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    onMarkAsRead?: (notificationId: string) => void;
    onMarkAllAsRead?: () => void;
    onLoadMore?: () => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
    notifications,
    unreadCount,
    loading,
    loadingMore,
    hasMore,
    onMarkAsRead,
    onMarkAllAsRead,
    onLoadMore
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const handleNotificationClick = (notification: Notification) => {
        // Mark as read
        onMarkAsRead?.(notification.id);

        // Navigate to the related report if available (force page reload to load fresh data)
        if (notification.related_entity_id) {
            // Use recipient_role to determine navigation
            if (notification.recipient_role === NotificationRole.ORG_MEMBER) {
                // Organization members go to report detail page (force reload)
                window.location.href = `/reports/${notification.related_entity_id}`;
            } else {
                // Hackers go to my-reports with report pre-selected (force reload)
                window.location.href = `/my-reports?reportId=${notification.related_entity_id}`;
            }

            setIsOpen(false); // Close the dropdown after navigation
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const formatTimeAgo = (dateString: string) => {
        const now = new Date();
        const date = new Date(dateString);

        // Calculate difference in milliseconds
        const diffInMs = now.getTime() - date.getTime();

        // If difference is negative or invalid, show "Just now"
        if (diffInMs < 0 || isNaN(diffInMs)) {
            return t('components.notificationDropdown.timeAgo.justNow');
        }

        const diffInSeconds = Math.floor(diffInMs / 1000);

        // Less than 1 minute
        if (diffInSeconds < 60) return t('components.notificationDropdown.timeAgo.justNow');

        // Less than 1 hour (show minutes)
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) {
            return `${diffInMinutes} ${diffInMinutes === 1 ? t('components.notificationDropdown.timeAgo.minute_one') : t('components.notificationDropdown.timeAgo.minute_other')} ${t('components.notificationDropdown.timeAgo.ago')}`;
        }

        // Less than 24 hours (show hours)
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) {
            return `${diffInHours} ${diffInHours === 1 ? t('components.notificationDropdown.timeAgo.hour_one') : t('components.notificationDropdown.timeAgo.hour_other')} ${t('components.notificationDropdown.timeAgo.ago')}`;
        }

        // Less than 30 days (show days)
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 30) {
            return `${diffInDays} ${diffInDays === 1 ? t('components.notificationDropdown.timeAgo.day_one') : t('components.notificationDropdown.timeAgo.day_other')} ${t('components.notificationDropdown.timeAgo.ago')}`;
        }

        // Less than 12 months (show months)
        const diffInMonths = Math.floor(diffInDays / 30);
        if (diffInMonths < 12) {
            return `${diffInMonths} ${diffInMonths === 1 ? t('components.notificationDropdown.timeAgo.month_one') : t('components.notificationDropdown.timeAgo.month_other')} ${t('components.notificationDropdown.timeAgo.ago')}`;
        }

        // 12 months or more (show years)
        const diffInYears = Math.floor(diffInMonths / 12);
        return `${diffInYears} ${diffInYears === 1 ? t('components.notificationDropdown.timeAgo.year_one') : t('components.notificationDropdown.timeAgo.year_other')} ${t('components.notificationDropdown.timeAgo.ago')}`;
    };

    const renderNotificationMessage = (notification: Notification) => {
        let params: Record<string, any> = {};
        let isJson = false;

        try {
            if (notification.message.startsWith('{') || notification.message.startsWith('[')) {
                params = JSON.parse(notification.message);
                isJson = true;
            }
        } catch (e) {
            // Not JSON or malformed, fallback to legacy
        }

        if (isJson) {
            // Translate params if they are status or severity
            if (params.old_status) params.old_status = getTranslatedStatus(params.old_status, t);
            if (params.new_status) params.new_status = getTranslatedStatus(params.new_status, t);

            if (params.old_severity) params.old_severity = getTranslatedSeverity(params.old_severity, t);
            if (params.new_severity) params.new_severity = getTranslatedSeverity(params.new_severity, t);

            const translationKey = `notifications.${notification.notification_type}.message`;
            return (
                <p className="text-sm text-gray-600 mt-1">
                    {t(translationKey, params) as string}
                </p>
            );
        }

        // --- LEGACY FALLBACKS ---


        // Parse status change notifications
        if (notification.notification_type === 'status_changed') {
            const [oldStatus, newStatus] = notification.message.split('|');
            // If it's a pipe-separated string, we need to translate the parts
            // However, most new notifications will come as JSON and be handled by the block above.
            // This block handles legacy plain-text messages if any exist.
            return (
                <div className="flex items-center gap-2 flex-wrap mt-1">
                    <span className="text-xs font-semibold">{getTranslatedStatus(oldStatus, t)}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-xs font-semibold">{getTranslatedStatus(newStatus, t)}</span>
                </div>
            );
        }

        // Parse severity change notifications
        if (notification.notification_type === 'severity_changed') {
            const [oldSeverity, newSeverity] = notification.message.split('|');
            return (
                <div className="flex items-center gap-2 flex-wrap mt-1">
                    <span className="text-xs font-semibold">{getTranslatedSeverity(oldSeverity, t)}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-xs font-semibold">{getTranslatedSeverity(newSeverity, t)}</span>
                </div>
            );
        }


        // For other legacy notifications, display the message as text
        return (
            <p className="text-sm text-gray-600 mt-1">
                {notification.message}
            </p>
        );
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => {
                    if (!isOpen && unreadCount > 0) {
                        onMarkAllAsRead?.();
                    }
                    setIsOpen(!isOpen);
                }}
                className="relative p-2 text-gray-600 hover:text-indigo-700 focus:outline-none cursor-pointer"
            >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5-5V7a3 3 0 00-6 0v5l-5 5h5m0 0v1a3 3 0 006 0v-1m-6 0h6" />
                </svg>
                {unreadCount > 0 && (
                    <span className={`absolute -top-1 -right-1 bg-red-500 text-white font-bold rounded-full h-5 w-5 flex items-center justify-center ${unreadCount > 99 ? 'text-[10px]' : 'text-xs'}`}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-2">
                        <div className="px-4 py-2 border-b border-gray-200">
                            <h3 className="text-sm font-medium text-gray-900">{t('components.notificationDropdown.title')}</h3>
                        </div>

                        <div className="max-h-96 overflow-y-auto">
                            {loading ? (
                                <div className="px-4 py-3 text-center text-gray-500">
                                    {t('components.notificationDropdown.loading')}
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="px-4 py-3 text-center text-gray-500">
                                    {t('components.notificationDropdown.noNotifications')}
                                </div>
                            ) : (
                                <>
                                    {notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                            onClick={() => handleNotificationClick(notification)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {t(`notifications.${notification.notification_type}.title`)}
                                                    </p>
                                                    {renderNotificationMessage(notification)}
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        {formatTimeAgo(notification.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {loadingMore && (
                                        <div className="px-4 py-3 text-center text-gray-500 text-sm">
                                            {t('components.notificationDropdown.loadingMore')}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {hasMore && !loading && !loadingMore && (
                            <div className="px-4 py-2 border-t border-gray-200">
                                <button
                                    onClick={onLoadMore}
                                    className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    {t('components.notificationDropdown.loadMore')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;