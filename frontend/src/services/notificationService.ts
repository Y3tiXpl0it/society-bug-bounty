// frontend/src/services/notificationService.ts
import { apiGet, apiPatch } from '../utils/apiClient';
import type { Notification, NotificationSummary } from '../types/notificationTypes';

class NotificationService {
    /**
     * Get notifications for the current user
     */
    async getUserNotifications(
        accessToken: string | null,
        skip: number = 0,
        limit: number = 50,
        onTokenRefresh?: (newToken: string) => void
    ): Promise<Notification[]> {
        return await apiGet(`/notifications/?skip=${skip}&limit=${limit}`, accessToken, onTokenRefresh);
    }

    /**
     * Get notification summary (total count and unread count)
     */
    async getNotificationSummary(
        accessToken: string | null,
        onTokenRefresh?: (newToken: string) => void
    ): Promise<NotificationSummary> {
        return await apiGet('/notifications/summary', accessToken, onTokenRefresh);
    }

    /**
     * Mark a specific notification as read
     */
    async markAsRead(
        accessToken: string | null,
        notificationId: string,
        onTokenRefresh?: (newToken: string) => void
    ): Promise<void> {
        await apiPatch(`/notifications/${notificationId}/read`, accessToken, {}, onTokenRefresh);
    }

    /**
     * Mark all notifications as read for the current user
     */
    async markAllAsRead(
        accessToken: string | null,
        onTokenRefresh?: (newToken: string) => void
    ): Promise<void> {
        await apiPatch('/notifications/mark-all-read', accessToken, {}, onTokenRefresh);
    }
}

const notificationService = new NotificationService();
export default notificationService;