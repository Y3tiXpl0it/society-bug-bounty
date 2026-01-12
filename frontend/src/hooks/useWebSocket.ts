// frontend/src/hooks/useWebSocket.ts
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import type { WebSocketMessage, NotificationEvent } from '../types/notificationTypes';

export const useWebSocket = (onNotification?: (data: NotificationEvent) => void) => {
    const { isLoggedIn, user, accessToken } = useAuth();
    const socketRef = useRef<Socket | null>(null);

    // 1. Use a ref to store the latest callback.
    const onNotificationRef = useRef(onNotification);

    // 2. Update the ref whenever the callback changes
    useEffect(() => {
        onNotificationRef.current = onNotification;
    }, [onNotification]);

    useEffect(() => {
        // If no valid session, disconnect and exit
        if (!isLoggedIn || !user || !accessToken) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            return;
        }

        const backendUrl = import.meta.env.DEV ? 'http://localhost:8000' : window.location.origin;

        // Initialize Socket.IO connection
        const socket = io(backendUrl, {
            path: '/socket.io/',
            auth: {
                token: `Bearer ${accessToken}`,
            },
            transports: ['websocket'],
            upgrade: false,
            timeout: 15000,
            forceNew: true,
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
        });

        socketRef.current = socket;

        // --- Event Handlers (Logs de debug eliminados) ---

        socket.on('disconnect', (reason) => {
            // Ignore intentional disconnects
            if (reason === 'io server disconnect' || reason === 'io client disconnect') {
                return;
            }
        });

        // Handle incoming notifications
        socket.on('notification', (message: WebSocketMessage) => {
            // 3. Call the function stored in the ref
            if (onNotificationRef.current) {
                onNotificationRef.current(message.data);
            }
        });

        socket.on('connect_error', (error) => {
            console.error('❌ WebSocket connection error:', error.message);
        });

        // Cleanup on unmount or user change
        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [isLoggedIn, user, accessToken]);

    return socketRef.current;
};
