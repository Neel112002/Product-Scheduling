// src/screens/admin/AdminDashboardScreen.tsx
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { AuthContext } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { ShiftsAPI, AdminAPI, SwapsAPI, DropsAPI, TimeOffAPI } from '../../api/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tile = {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    description: string;
    color: string;
    onPress: () => void;
    badge?: string;
};

type Stats = {
    totalHours: number | null;
    totalStaff: number | null;
    totalCost:  number | null;
    loading:    boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekStart(): string {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminDashboardScreen({ navigation }: any) {
    const { logout, user }  = useContext(AuthContext);
    const { unreadCount }   = useNotifications();

    const locationId = user?.primaryLocation?.id ?? null;

    const [stats, setStats] = useState<Stats>({
        totalHours: null, totalStaff: null, totalCost: null, loading: true,
    });

    const [pendingSwaps,    setPendingSwaps]    = useState(0);
    const [pendingDrops,    setPendingDrops]    = useState(0);
    const [pendingTimeoffs, setPendingTimeoffs] = useState(0);

    // ── Fetch stats ───────────────────────────────────────────────────────────
    const fetchStats = useCallback(async () => {
        if (!locationId) {
            setStats(s => ({ ...s, loading: false }));
            return;
        }
        setStats(s => ({ ...s, loading: true }));
        try {
            const weekStart = getWeekStart();
            const [laborRes, staffRes] = await Promise.allSettled([
                ShiftsAPI.laborCost(locationId, weekStart),
                AdminAPI.listStaff(locationId),
            ]);
            const labor     = laborRes.status     === 'fulfilled' ? laborRes.value.data     : null;
            const staffList = staffRes.status === 'fulfilled' ? (staffRes.value.data?.staff ?? []) : [];
            setStats({
                totalHours: labor?.total_hours ?? null,
                totalCost:  labor?.total_cost  ?? null,
                totalStaff: staffList.length,
                loading: false,
            });
        } catch {
            setStats({ totalHours: null, totalStaff: null, totalCost: null, loading: false });
        }
    }, [locationId]);

    // ── Fetch pending request counts ──────────────────────────────────────────
    const fetchPendingCounts = useCallback(async () => {
        if (!locationId) return;
        try {
            const [swapsRes, dropsRes, timeoffRes] = await Promise.allSettled([
                SwapsAPI.pendingManager(locationId),
                DropsAPI.pendingDrops(locationId),
                TimeOffAPI.pending(),
            ]);
            if (swapsRes.status   === 'fulfilled') setPendingSwaps(swapsRes.value.data?.swaps?.length ?? 0);
            if (dropsRes.status   === 'fulfilled') setPendingDrops(dropsRes.value.data?.drops?.length ?? 0);
            if (timeoffRes.status === 'fulfilled') setPendingTimeoffs(timeoffRes.value.data?.requests?.length ?? 0);
        } catch {}
    }, [locationId]);

    useEffect(() => {
        fetchStats();
        fetchPendingCounts();
    }, [fetchStats, fetchPendingCounts]);

    // ── Display values ────────────────────────────────────────────────────────
    const hoursDisplay = stats.loading ? null : stats.totalHours !== null ? `${stats.totalHours}h` : '—';
    const staffDisplay = stats.loading ? null : stats.totalStaff !== null ? String(stats.totalStaff) : '—';
    const costDisplay  = stats.loading ? null : stats.totalCost  !== null ? `$${stats.totalCost}`   : '—';

    const totalPending = pendingSwaps + pendingDrops + pendingTimeoffs;

    // ── Identity ──────────────────────────────────────────────────────────────
    const roleName    = user?.role?.name ?? 'Manager';
    const displayName = user?.display_name || user?.username || 'Admin';
    const initials    = displayName.trim().split(/\s+/).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();

    // ── Tiles ─────────────────────────────────────────────────────────────────
    const tiles: Tile[] = [
        {
            icon: 'calendar-outline',
            label: 'Schedule',
            description: 'Create, edit and publish weekly shifts.',
            color: colors.primary,
            badge: 'Core',
            onPress: () => navigation.navigate('Schedule', {}),
        },
        {
            icon: 'people-outline',
            label: 'Team & Roles',
            description: 'Manage staff, permissions and invites.',
            color: '#10B981',
            onPress: () => navigation.navigate('TeamRoles'),
        },
        {
            icon: 'person-add-outline',
            label: 'Invite Staff',
            description: 'Send onboarding invites to new employees.',
            color: '#F59E0B',
            onPress: () => navigation.navigate('InviteStaff'),
        },
        {
            icon: 'time-outline',
            label: 'Clock Mgmt',
            description: 'Clock staff in/out and manage timesheets.',
            color: '#0EA5E9',
            onPress: () => navigation.navigate('ClockManagement', { locationId: locationId ?? 0 }),
        },
        {
            icon: 'stats-chart-outline',
            label: 'Analytics',
            description: 'Track hours, labor cost and overtime.',
            color: '#EF4444',
            onPress: () => navigation.navigate('Analytics', { locationId: locationId ?? 0 }),
        },
        {
            icon: 'layers-outline',
            label: 'Requests',
            description: 'Approve swaps, drops and time off.',
            color: '#F59E0B',
            badge: totalPending > 0 ? String(totalPending) : undefined,
            onPress: () => navigation.navigate('AdminRequests', { locationId: locationId ?? 0 }),
        },
        {
            icon: 'sparkles-outline',
            label: 'AI Assistant',
            description: 'Auto-generate schedules with AI.',
            color: '#8B5CF6',
            badge: 'Advanced',
            onPress: () => navigation.navigate('AIAssistant'),
        },
    ];

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{initials}</Text>
                        </View>
                        <View>
                            <Text style={styles.greeting}>Good day,</Text>
                            <Text style={styles.name}>{displayName}</Text>
                            <View style={styles.rolePill}>
                                <Text style={styles.roleText}>{roleName}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.headerRight}>
                        <Pressable
                            onPress={() => navigation.navigate('Notifications')}
                            style={styles.iconBtn}
                        >
                            <Ionicons name="notifications-outline" size={22} color={colors.gray} />
                            {unreadCount > 0 && (
                                <View style={styles.notifBadge}>
                                    <Text style={styles.notifBadgeText}>
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </Text>
                                </View>
                            )}
                        </Pressable>
                        <Pressable onPress={logout} style={styles.iconBtn}>
                            <Ionicons name="log-out-outline" size={22} color={colors.gray} />
                        </Pressable>
                    </View>
                </View>

                {/* Stats row */}
                <View style={styles.statsRow}>
                    <StatChip icon="time-outline"    label="This week" value={hoursDisplay} loading={stats.loading} color={colors.primary} />
                    <StatChip icon="people-outline"  label="Staff"     value={staffDisplay} loading={stats.loading} color="#10B981"        />
                    <StatChip icon="cash-outline"    label="Est. cost" value={costDisplay}  loading={stats.loading} color="#F59E0B"        />
                </View>

                {/* Pending requests banner */}
                {totalPending > 0 && (
                    <Pressable
                        style={styles.pendingBanner}
                        onPress={() => navigation.navigate('AdminRequests', { locationId: locationId ?? 0 })}
                    >
                        <View style={styles.pendingBannerLeft}>
                            <View style={styles.pendingDot} />
                            <Text style={styles.pendingBannerText}>
                                {totalPending} pending request{totalPending > 1 ? 's' : ''} need your attention
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.warning} />
                    </Pressable>
                )}

                {/* Tiles grid */}
                <Text style={styles.sectionLabel}>Management</Text>
                <View style={styles.grid}>
                    {tiles.map((tile, index) => (
                        <AdminTile key={`tile-${index}-${tile.label}`} tile={tile} />
                    ))}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ── StatChip ──────────────────────────────────────────────────────────────────

function StatChip({
    icon, label, value, loading, color,
}: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    value: string | null;
    loading: boolean;
    color: string;
}) {
    return (
        <View style={statStyles.chip}>
            <View style={[statStyles.iconWrap, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={16} color={color} />
            </View>
            {loading
                ? <ActivityIndicator size="small" color={color} style={{ marginVertical: 2 }} />
                : <Text style={[statStyles.value, { color }]}>{value ?? '—'}</Text>
            }
            <Text style={statStyles.label}>{label}</Text>
        </View>
    );
}

// ── AdminTile ─────────────────────────────────────────────────────────────────

function AdminTile({ tile }: { tile: Tile }) {
    return (
        <Pressable
            style={({ pressed }) => [
                tileStyles.tile,
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
            onPress={tile.onPress}
        >
            <View style={[tileStyles.iconWrap, { backgroundColor: tile.color + '15' }]}>
                <Ionicons name={tile.icon} size={26} color={tile.color} />
            </View>
            {tile.badge && (
                <View style={[
                    tileStyles.badge,
                    !isNaN(Number(tile.badge)) && { backgroundColor: colors.error + '15' },
                ]}>
                    <Text style={[
                        tileStyles.badgeText,
                        !isNaN(Number(tile.badge)) && { color: colors.error },
                    ]}>
                        {tile.badge}
                    </Text>
                </View>
            )}
            <Text style={tileStyles.label}>{tile.label}</Text>
            <Text style={tileStyles.desc} numberOfLines={2}>{tile.description}</Text>
            <View style={tileStyles.arrow}>
                <Ionicons name="arrow-forward" size={14} color={colors.gray} />
            </View>
        </Pressable>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:    { flex: 1, backgroundColor: '#F8F8FC' },
    scroll:  { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },

    header: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 20,
    },
    headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    avatar: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
    },
    avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
    greeting:   { fontSize: 12, color: colors.gray },
    name:       { fontSize: 18, fontWeight: '800', color: colors.text },
    rolePill: {
        marginTop: 4, alignSelf: 'flex-start',
        paddingHorizontal: 8, paddingVertical: 2,
        borderRadius: 999, backgroundColor: colors.primary + '15',
    },
    roleText: { fontSize: 11, color: colors.primary, fontWeight: '700' },

    iconBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#F3F4F6',
        alignItems: 'center', justifyContent: 'center', position: 'relative',
    },
    notifBadge: {
        position: 'absolute', top: 4, right: 4,
        minWidth: 16, height: 16, borderRadius: 8,
        backgroundColor: colors.error,
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 2, borderWidth: 1.5, borderColor: '#F8F8FC',
    },
    notifBadgeText: { fontSize: 9, color: '#fff', fontWeight: '800' },

    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },

    pendingBanner: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.warning + '12',
        borderRadius: 12, padding: 12, marginBottom: 20,
        borderWidth: 1, borderColor: colors.warning + '30',
    },
    pendingBannerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pendingDot: {
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: colors.warning,
    },
    pendingBannerText:  { fontSize: 13, fontWeight: '600', color: colors.warning },

    sectionLabel: {
        fontSize: 13, fontWeight: '700', color: colors.gray,
        letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});

const statStyles = StyleSheet.create({
    chip: {
        flex: 1, alignItems: 'center', gap: 4,
        backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14,
        borderWidth: 1, borderColor: '#EFEFEF',
        shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
    },
    iconWrap: {
        width: 32, height: 32, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center', marginBottom: 2,
    },
    value: { fontSize: 16, fontWeight: '800' },
    label: { fontSize: 11, color: colors.gray },
});

const tileStyles = StyleSheet.create({
    tile: {
        width: '47%', backgroundColor: '#fff',
        borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: '#EFEFEF',
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
        position: 'relative', minHeight: 140,
    },
    iconWrap: {
        width: 48, height: 48, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    },
    badge: {
        position: 'absolute', top: 10, right: 10,
        paddingHorizontal: 7, paddingVertical: 2,
        borderRadius: 999, backgroundColor: colors.primary + '15',
    },
    badgeText: { fontSize: 9, color: colors.primary, fontWeight: '800', letterSpacing: 0.5 },
    label:     { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
    desc:      { fontSize: 11, color: colors.gray, lineHeight: 15 },
    arrow:     { position: 'absolute', bottom: 12, right: 12 },
});