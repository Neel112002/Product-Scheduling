// src/screens/NotificationsScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { colors }       from '../theme/colors';
import { NotificationsAPI } from '../api/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type AppNotification = {
    notif_id:   number;
    type:       string;
    title:      string;
    body:       string;
    data?:      Record<string, any>;
    is_read:    boolean;
    created_at: string;
};

// ── Icon map ──────────────────────────────────────────────────────────────────

function getIcon(type: string): {
    name: React.ComponentProps<typeof Ionicons>['name'];
    color: string;
} {
    const map: Record<string, { name: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
        schedule_published:   { name: 'calendar-outline',        color: colors.success  },
        shift_assigned:       { name: 'checkmark-circle-outline', color: colors.primary  },
        shift_cancelled:      { name: 'close-circle-outline',     color: colors.error    },
        swap_requested:       { name: 'swap-horizontal-outline',  color: colors.warning  },
        swap_accepted:        { name: 'checkmark-done-outline',   color: colors.success  },
        swap_rejected:        { name: 'close-outline',            color: colors.error    },
        swap_needs_approval:  { name: 'alert-circle-outline',     color: colors.warning  },
        swap_approved:        { name: 'shield-checkmark-outline', color: colors.success  },
        ai_schedule_ready:    { name: 'sparkles-outline',         color: colors.primary  },
        ai_prediction_ready:  { name: 'analytics-outline',        color: colors.primary  },
    };
    return map[type] ?? { name: 'notifications-outline', color: colors.gray };
}

// ── Time formatter ────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins  / 60);
    const days  = Math.floor(hours / 24);

    if (mins  < 1)   return 'Just now';
    if (mins  < 60)  return `${mins}m ago`;
    if (hours < 24)  return `${hours}h ago`;
    if (days  < 7)   return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationsScreen({ navigation }: any) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount,   setUnreadCount]   = useState(0);
    const [loading,       setLoading]       = useState(true);
    const [refreshing,    setRefreshing]    = useState(false);
    const [markingAll,    setMarkingAll]    = useState(false);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchNotifications = useCallback(async () => {
        try {
            const { data } = await NotificationsAPI.list(50);
            setNotifications(data.notifications ?? []);
            setUnreadCount(data.unread_count   ?? 0);
        } catch (e) {
            console.warn('[NotificationsScreen] fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchNotifications();
        setRefreshing(false);
    }, [fetchNotifications]);

    // ── Mark single as read ───────────────────────────────────────────────────
    const handleMarkRead = useCallback(async (notif: AppNotification) => {
        if (notif.is_read) return;
        try {
            await NotificationsAPI.markRead(notif.notif_id);
            setNotifications(prev =>
                prev.map(n =>
                    n.notif_id === notif.notif_id ? { ...n, is_read: true } : n
                )
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch {}
    }, []);

    // ── Mark all as read ──────────────────────────────────────────────────────
    const handleMarkAllRead = useCallback(async () => {
        if (unreadCount === 0) return;
        setMarkingAll(true);
        try {
            await NotificationsAPI.markAllRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch {}
        setMarkingAll(false);
    }, [unreadCount]);

    // ── Render item ───────────────────────────────────────────────────────────
    const renderItem = useCallback(({ item }: { item: AppNotification }) => {
        const { name: iconName, color: iconColor } = getIcon(item.type);

        return (
            <Pressable
                style={[
                    styles.notifCard,
                    !item.is_read && styles.notifCardUnread,
                ]}
                onPress={() => handleMarkRead(item)}
            >
                {/* Unread dot */}
                {!item.is_read && <View style={styles.unreadDot} />}

                {/* Icon */}
                <View style={[styles.iconWrap, { backgroundColor: iconColor + '18' }]}>
                    <Ionicons name={iconName} size={22} color={iconColor} />
                </View>

                {/* Content */}
                <View style={styles.notifContent}>
                    <View style={styles.notifTopRow}>
                        <Text
                            style={[
                                styles.notifTitle,
                                !item.is_read && styles.notifTitleUnread,
                            ]}
                            numberOfLines={1}
                        >
                            {item.title}
                        </Text>
                        <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
                    </View>
                    <Text style={styles.notifBody} numberOfLines={2}>
                        {item.body}
                    </Text>
                </View>
            </Pressable>
        );
    }, [handleMarkRead]);

    // ── Empty state ───────────────────────────────────────────────────────────
    const EmptyState = () => (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
                <Ionicons name="notifications-off-outline" size={48} color={colors.gray} />
            </View>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
                Notifications about your shifts, swaps and schedule will appear here.
            </Text>
        </View>
    );

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>

            {/* Header */}
            <View style={styles.header}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                >
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>

                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Notifications</Text>
                    {unreadCount > 0 && (
                        <View style={styles.headerBadge}>
                            <Text style={styles.headerBadgeText}>{unreadCount}</Text>
                        </View>
                    )}
                </View>

                {unreadCount > 0 && (
                    <Pressable
                        onPress={handleMarkAllRead}
                        disabled={markingAll}
                        style={styles.markAllBtn}
                    >
                        {markingAll
                            ? <ActivityIndicator size="small" color={colors.primary} />
                            : <Text style={styles.markAllText}>Mark all read</Text>
                        }
                    </Pressable>
                )}
            </View>

            {/* Filter tabs */}
            <View style={styles.tabs}>
                <View style={styles.tabActive}>
                    <Text style={styles.tabActiveText}>All</Text>
                </View>
                {unreadCount > 0 && (
                    <View style={styles.tabUnread}>
                        <Text style={styles.tabUnreadText}>{unreadCount} unread</Text>
                    </View>
                )}
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={item => String(item.notif_id)}
                    renderItem={renderItem}
                    ListEmptyComponent={EmptyState}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    contentContainerStyle={[
                        styles.listContent,
                        notifications.length === 0 && styles.listContentEmpty,
                    ]}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
            )}
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8F8FC' },

    // Header
    header: {
        flexDirection:     'row',
        alignItems:        'center',
        paddingHorizontal: 16,
        paddingVertical:   12,
        backgroundColor:   '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backBtn: { padding: 4, marginRight: 8 },
    headerCenter: {
        flex:          1,
        flexDirection: 'row',
        alignItems:    'center',
        gap:           8,
    },
    headerTitle:     { fontSize: 18, fontWeight: '700', color: colors.text },
    headerBadge: {
        paddingHorizontal: 8,
        paddingVertical:   2,
        borderRadius:      999,
        backgroundColor:   colors.error,
    },
    headerBadgeText: { fontSize: 12, color: '#fff', fontWeight: '700' },
    markAllBtn:      { paddingHorizontal: 8, paddingVertical: 4 },
    markAllText:     { fontSize: 12, color: colors.primary, fontWeight: '600' },

    // Tabs
    tabs: {
        flexDirection:     'row',
        alignItems:        'center',
        gap:               8,
        paddingHorizontal: 16,
        paddingVertical:   10,
        backgroundColor:   '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    tabActive: {
        paddingHorizontal: 14,
        paddingVertical:    6,
        borderRadius:      999,
        backgroundColor:   colors.primary,
    },
    tabActiveText: { fontSize: 13, color: '#fff', fontWeight: '700' },
    tabUnread: {
        paddingHorizontal: 14,
        paddingVertical:    6,
        borderRadius:      999,
        backgroundColor:   colors.error + '15',
        borderWidth:       1,
        borderColor:       colors.error + '30',
    },
    tabUnreadText: { fontSize: 13, color: colors.error, fontWeight: '600' },

    // List
    listContent:      { paddingVertical: 8 },
    listContentEmpty: { flex: 1 },
    separator:        { height: 1, backgroundColor: '#F5F5F5', marginLeft: 80 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // Notification card
    notifCard: {
        flexDirection:     'row',
        alignItems:        'flex-start',
        paddingHorizontal: 16,
        paddingVertical:   14,
        backgroundColor:   '#fff',
        position:          'relative',
    },
    notifCardUnread: { backgroundColor: colors.primary + '04' },
    unreadDot: {
        position:        'absolute',
        left:            6,
        top:             20,
        width:           6,
        height:          6,
        borderRadius:    3,
        backgroundColor: colors.primary,
    },
    iconWrap: {
        width:          44,
        height:         44,
        borderRadius:   22,
        alignItems:     'center',
        justifyContent: 'center',
        marginRight:    12,
        flexShrink:     0,
    },
    notifContent:  { flex: 1 },
    notifTopRow: {
        flexDirection:  'row',
        alignItems:     'flex-start',
        justifyContent: 'space-between',
        gap:            8,
        marginBottom:   3,
    },
    notifTitle: {
        flex:       1,
        fontSize:   14,
        color:      colors.text,
        fontWeight: '500',
    },
    notifTitleUnread: { fontWeight: '700' },
    notifTime:   { fontSize: 11, color: colors.gray, flexShrink: 0 },
    notifBody:   { fontSize: 13, color: colors.gray, lineHeight: 18 },

    // Empty state
    emptyContainer: {
        flex:           1,
        alignItems:     'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        gap:            12,
    },
    emptyIconWrap: {
        width:           80,
        height:          80,
        borderRadius:    40,
        backgroundColor: '#F3F4F6',
        alignItems:      'center',
        justifyContent:  'center',
        marginBottom:    8,
    },
    emptyTitle:    { fontSize: 18, fontWeight: '700', color: colors.text },
    emptySubtitle: {
        fontSize:   13,
        color:      colors.gray,
        textAlign:  'center',
        lineHeight: 20,
    },
});