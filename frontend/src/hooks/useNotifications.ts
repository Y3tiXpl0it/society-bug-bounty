// frontend/src/hooks/useNotifications.ts

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useWebSocket } from './useWebSocket';
import notificationService from '../services/notificationService';
import type { Notification, NotificationSummary, NotificationEvent } from '../types/notificationTypes';

const LOAD_INCREMENT = 20;

export const useNotifications = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [summary, setSummary] = useState<NotificationSummary>({ total: 0, unread: 0 });
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);

    const { isLoggedIn, user, accessToken, setAccessToken } = useAuth();

    /**
     * --- HANDLE NEW NOTIFICATION (WebSocket) ---
     * * This callback processes incoming WebSocket events.
     * * CRITICAL FIX:
     * 1. Wrapped in useCallback with an empty dependency array [] to ensure the function reference
     * remains stable and doesn't cause the WebSocket to reconnect unnecessarily.
     * 2. Uses functional state updates (prev => ...) to ensure we always append to the
     * latest state, preventing stale closure issues where notifications might disappear.
     */
    const handleNewNotification = useCallback((eventData: NotificationEvent) => {
        // Construct the full Notification object from the event data
        const newNotification: Notification = {
            id: eventData.id,
            user_id: eventData.user_id,
            title: eventData.title,
            message: eventData.message,
            is_read: false, // New notifications are always unread
            severity: eventData.severity,
            created_at: eventData.created_at,
            related_entity_id: eventData.related_entity_id,
            notification_type: eventData.notification_type,
            recipient_role: eventData.recipient_role,
        };

        // Update notifications list (prepend new item)
        setNotifications((prevNotifications) => {
            // Prevent potential duplicates if the socket sends the same event twice
            if (prevNotifications.some((n) => n.id === newNotification.id)) {
                return prevNotifications;
            }
            return [newNotification, ...prevNotifications];
        });

        // Update summary counters (increment unread and total)
        setSummary((prevSummary) => ({
            ...prevSummary,
            total: prevSummary.total + 1,
            unread: prevSummary.unread + 1,
        }));
    }, []); // Empty dependencies: this function never needs to be recreated

    // --- WEBSOCKET INTEGRATION ---
    // Pass the stable callback to the hook
    useWebSocket(handleNewNotification);

    // --- INITIAL LOAD ---
    const loadNotifications = useCallback(async () => {
        if (!isLoggedIn) return;

        setLoading(true);
        setError(null);
        try {
            // Fetch initial list and summary in parallel
            const [notificationsData, summaryData] = await Promise.all([
                notificationService.getUserNotifications(accessToken, 0, LOAD_INCREMENT, setAccessToken),
                notificationService.getNotificationSummary(accessToken, setAccessToken),
            ]);

            setNotifications(notificationsData);
            setSummary(summaryData);
            setHasMore(notificationsData.length >= LOAD_INCREMENT);
        } catch (err: any) {
            console.error('Error loading notifications:', err);
            setError('Failed to load notifications');
        } finally {
            setLoading(false);
        }
    }, [isLoggedIn, accessToken, setAccessToken]);

    // --- PAGINATION (LOAD MORE) ---
    const loadMoreNotifications = useCallback(async () => {
        if (loadingMore || !hasMore) return;

        setLoadingMore(true);
        try {
            const currentCount = notifications.length;
            const moreNotifications = await notificationService.getUserNotifications(
                accessToken,
                currentCount,
                LOAD_INCREMENT,
                setAccessToken
            );

            if (moreNotifications.length < LOAD_INCREMENT) {
                setHasMore(false);
            }

            // Append new notifications to the end of the list
            setNotifications((prev) => [...prev, ...moreNotifications]);
        } catch (err) {
            console.error('Error loading more notifications:', err);
        } finally {
            setLoadingMore(false);
        }
    }, [accessToken, notifications.length, loadingMore, hasMore, setAccessToken]);

    // --- MARK AS READ ---
    const markAsRead = useCallback(
        async (notificationId: string) => {
            try {
                // Optimistic UI update: Update state immediately before API response
                setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)));

                setSummary((prev) => ({
                    ...prev,
                    unread: Math.max(0, prev.unread - 1),
                }));

                // Perform API call in background
                await notificationService.markAsRead(accessToken, notificationId, setAccessToken);
            } catch (error) {
                console.error('Error marking notification as read:', error);
                // Ideally revert state here if API fails
            }
        },
        [accessToken, setAccessToken]
    );

    // --- MARK ALL AS READ ---
    const markAllAsRead = useCallback(async () => {
        try {
            // Optimistic UI update
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            setSummary((prev) => ({ ...prev, unread: 0 }));

            // API call
            await notificationService.markAllAsRead(accessToken, setAccessToken);
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }, [accessToken, setAccessToken]);

    // --- LIFECYCLE ---
    // Load notifications when user logs in or component mounts
    useEffect(() => {
        if (isLoggedIn && user) {
            loadNotifications();
        } else {
            // Clear state on logout
            setNotifications([]);
            setSummary({ total: 0, unread: 0 });
        }
    }, [isLoggedIn, user, loadNotifications]);

    return {
        notifications,
        summary,
        unreadCount: summary.unread,
        loading,
        loadingMore,
        error,
        hasMore,
        loadNotifications,
        loadMoreNotifications,
        handleNewNotification,
        markAsRead,
        markAllAsRead,
    };
};
