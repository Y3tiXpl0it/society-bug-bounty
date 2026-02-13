// frontend/src/types/notificationTypes.ts

export const NotificationRole = {
    HACKER: 'hacker',
    ORG_MEMBER: 'org_member',
    ADMIN: 'admin'
} as const;

export type NotificationRole = typeof NotificationRole[keyof typeof NotificationRole];

export interface Notification {
    id: string;
    user_id: string;
    notification_type: string;
    message: string;
    is_read: boolean;
    recipient_role: NotificationRole | string;
    related_entity_id?: string;
    created_at: string;
    severity: 'low' | 'medium' | 'high' | 'critical' | 'info' | string;
}

export interface NotificationSummary {
    total: number;
    unread: number;
}

export interface NotificationEvent {
    id: string;
    user_id: string;
    message: string;
    severity: string;
    notification_type: string;
    recipient_role: string;
    related_entity_id?: string;
    created_at: string;
}

export interface WebSocketMessage {
    event_type: string;
    data: NotificationEvent;
    timestamp: string;
}
