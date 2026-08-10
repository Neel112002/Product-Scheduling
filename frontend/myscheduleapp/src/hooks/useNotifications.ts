// src/hooks/useNotifications.ts
/**
 * Fetches in-app notifications and tracks unread count.
 *
 * Usage:
 *   const { notifications, unreadCount, markRead, markAllRead, refetch } =
 *       useNotifications();
 */
import { useCallback, useEffect, useState } from 'react';
import { NotificationsAPI } from '../api/api';

export type AppNotification = {
    notif_id:   number;
    type:       string;
    title:      string;
    body:       string;
    data?:      Record<string, any>;
    is_read:    boolean;
    created_at: string;
};

export function useNotifications() {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount]     = useState(0);
    const [loading, setLoading]             = useState(false);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await NotificationsAPI.list(50);
            setNotifications(data.notifications ?? []);
            setUnreadCount(data.unread_count ?? 0);
        } catch {
            // Silent fail — notifications are non-critical
        } finally {
            setLoading(false);
        }
    }, []);

    const markRead = useCallback(async (notif_id: number) => {
        try {
            await NotificationsAPI.markRead(notif_id);
            setNotifications(prev =>
                prev.map(n => n.notif_id === notif_id ? { ...n, is_read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch {}
    }, []);

    const markAllRead = useCallback(async () => {
        try {
            await NotificationsAPI.markAllRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch {}
    }, []);

    // Fetch on mount
    useEffect(() => { fetch(); }, [fetch]);

    // Poll every 60s for new notifications
    useEffect(() => {
        const interval = setInterval(fetch, 60_000);
        return () => clearInterval(interval);
    }, [fetch]);

    return { notifications, unreadCount, loading, refetch: fetch, markRead, markAllRead };
}