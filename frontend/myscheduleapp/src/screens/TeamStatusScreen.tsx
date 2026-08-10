// src/screens/TeamStatusScreen.tsx
import React, { useCallback, useContext, useEffect, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { TimeEntryAPI, AdminAPI } from '../api/api';
import { AuthContext } from '../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type TeamMemberStatus = {
    user_id: number;
    name: string;
    initials: string;
    role: string;
    status: 'working' | 'on_break' | 'late' | 'scheduled';
    shift_start?: string | null;
    shift_end?: string | null;
    clocked_in?: string | null;
};

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
    color: string;
    label: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    bg: string;
}> = {
    working:   { color: '#10B981', label: 'Working',   icon: 'checkmark-circle-outline', bg: '#10B98115' },
    on_break:  { color: '#F59E0B', label: 'On break',  icon: 'cafe-outline',             bg: '#F59E0B15' },
    late:      { color: '#EF4444', label: 'Late',      icon: 'alert-circle-outline',     bg: '#EF444415' },
    scheduled: { color: '#6366F1', label: 'Scheduled', icon: 'time-outline',             bg: '#6366F115' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-CA', {
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
}

function timeSince(iso: string): string {
    const diff  = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TeamStatusScreen({ route, navigation }: any) {
    const { user: authUser } = useContext(AuthContext);

    const [resolvedLocationId, setResolvedLocationId] = useState<number | null>(
        route?.params?.locationId ?? null
    );
    const [locationName, setLocationName] = useState<string>('');
    const [team,         setTeam]         = useState<TeamMemberStatus[]>([]);
    const [loading,      setLoading]      = useState(true);
    const [refreshing,   setRefreshing]   = useState(false);
    const [filter,       setFilter]       = useState<string | null>(null);

    // ── Resolve locationId if not passed ──────────────────────────────────────
    useEffect(() => {
        if (resolvedLocationId) return;

        // Try auth user first
        const fromAuth = authUser?.primaryLocation?.id;
        if (fromAuth) {
            setResolvedLocationId(fromAuth);
            setLocationName(authUser?.primaryLocation?.name ?? '');
            return;
        }

        // Fallback: fetch from REST
        AdminAPI.listLocations().then(({ data }) => {
            const locs = data?.locations ?? [];
            if (locs.length) {
                setResolvedLocationId(locs[0].id);
                setLocationName(locs[0].name ?? '');
            }
        }).catch(() => {});
    }, [resolvedLocationId, authUser]);

    // Set location name from locations list if we have an id but no name
    useEffect(() => {
        if (!resolvedLocationId || locationName) return;
        AdminAPI.listLocations().then(({ data }) => {
            const loc = (data?.locations ?? []).find((l: any) => l.id === resolvedLocationId);
            if (loc) setLocationName(loc.name ?? '');
        }).catch(() => {});
    }, [resolvedLocationId, locationName]);

    // ── Fetch team ────────────────────────────────────────────────────────────
    const fetchTeam = useCallback(async () => {
        if (!resolvedLocationId) return;
        try {
            const { data } = await TimeEntryAPI.getTeamStatus(resolvedLocationId);
            // Sort: late → working → on_break → scheduled
            const order: Record<string, number> = {
                late: 0, working: 1, on_break: 2, scheduled: 3,
            };
            const sorted = (data?.team ?? []).sort(
                (a: TeamMemberStatus, b: TeamMemberStatus) =>
                    (order[a.status] ?? 4) - (order[b.status] ?? 4)
            );
            setTeam(sorted);
        } catch {
            setTeam([]);
        } finally {
            setLoading(false);
        }
    }, [resolvedLocationId]);

    useEffect(() => { fetchTeam(); }, [fetchTeam]);

    // Auto-refresh every 30s
    useEffect(() => {
        const interval = setInterval(fetchTeam, 30_000);
        return () => clearInterval(interval);
    }, [fetchTeam]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchTeam();
        setRefreshing(false);
    }, [fetchTeam]);

    // ── Counts ────────────────────────────────────────────────────────────────
    const counts = {
        working:   team.filter(m => m.status === 'working').length,
        on_break:  team.filter(m => m.status === 'on_break').length,
        late:      team.filter(m => m.status === 'late').length,
        scheduled: team.filter(m => m.status === 'scheduled').length,
    };

    const filtered = filter ? team.filter(m => m.status === filter) : team;

    // ── Render member ─────────────────────────────────────────────────────────
    const renderMember = ({ item }: { item: TeamMemberStatus }) => {
        const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.scheduled;
        return (
            <View style={memberStyles.card}>
                {/* Avatar */}
                <View style={[memberStyles.avatarWrap, { borderColor: cfg.color }]}>
                    <View style={[memberStyles.avatar, { backgroundColor: cfg.bg }]}>
                        <Text style={[memberStyles.avatarText, { color: cfg.color }]}>
                            {item.initials}
                        </Text>
                    </View>
                    <View style={[memberStyles.dot, { backgroundColor: cfg.color }]} />
                </View>

                {/* Info */}
                <View style={memberStyles.info}>
                    <Text style={memberStyles.name}>{item.name}</Text>
                    <Text style={memberStyles.role}>{item.role}</Text>
                    {item.shift_start && item.shift_end && (
                        <Text style={memberStyles.shiftTime}>
                            {formatTime(item.shift_start)} – {formatTime(item.shift_end)}
                        </Text>
                    )}
                </View>

                {/* Status */}
                <View style={memberStyles.right}>
                    <View style={[memberStyles.statusBadge, { backgroundColor: cfg.bg }]}>
                        <Ionicons name={cfg.icon} size={12} color={cfg.color} />
                        <Text style={[memberStyles.statusText, { color: cfg.color }]}>
                            {cfg.label}
                        </Text>
                    </View>
                    {item.status === 'working' && item.clocked_in && (
                        <Text style={memberStyles.detail}>{timeSince(item.clocked_in)} worked</Text>
                    )}
                    {item.status === 'late' && item.shift_start && (
                        <Text style={[memberStyles.detail, { color: '#EF4444' }]}>
                            Since {formatTime(item.shift_start)}
                        </Text>
                    )}
                    {item.status === 'on_break' && (
                        <Text style={memberStyles.detail}>On break</Text>
                    )}
                    {item.status === 'scheduled' && item.shift_start && (
                        <Text style={memberStyles.detail}>
                            Starts {formatTime(item.shift_start)}
                        </Text>
                    )}
                </View>
            </View>
        );
    };

    // ── No location resolved yet ──────────────────────────────────────────────
    if (!resolvedLocationId && !loading) {
        return (
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color={colors.text} />
                    </Pressable>
                    <Text style={styles.headerTitle}>Today's Team</Text>
                </View>
                <View style={styles.emptyContainer}>
                    <Ionicons name="location-outline" size={40} color={colors.inputBorder} />
                    <Text style={styles.emptyTitle}>No location found</Text>
                    <Text style={styles.emptySub}>Could not determine your location.</Text>
                </View>
            </SafeAreaView>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>

            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Today's Team</Text>
                    {locationName ? (
                        <Text style={styles.headerSub}>{locationName}</Text>
                    ) : null}
                </View>
                <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>Live</Text>
                </View>
            </View>

            {/* Summary counts */}
            <View style={styles.summaryBar}>
                {[
                    { color: '#10B981', label: 'Working',   count: counts.working },
                    { color: '#F59E0B', label: 'On break',  count: counts.on_break },
                    { color: '#EF4444', label: 'Late',      count: counts.late },
                    { color: '#6366F1', label: 'Scheduled', count: counts.scheduled },
                ].map(item => (
                    <Pressable
                        key={item.label}
                        style={styles.summaryItem}
                        onPress={() => setFilter(
                            filter === item.label.toLowerCase().replace(' ', '_')
                                ? null
                                : item.label.toLowerCase().replace(' ', '_')
                        )}
                    >
                        <Text style={[styles.summaryCount, { color: item.color }]}>
                            {item.count}
                        </Text>
                        <Text style={styles.summaryLabel}>{item.label}</Text>
                    </Pressable>
                ))}
            </View>

            {/* Filter pills */}
            <View style={styles.pillRow}>
                {[
                    { key: null,       label: 'All',        count: team.length },
                    { key: 'working',  label: '🟢 Working', count: counts.working },
                    { key: 'on_break', label: '🟡 Break',   count: counts.on_break },
                    { key: 'late',     label: '🔴 Late',    count: counts.late },
                    { key: 'scheduled',label: '🔵 Soon',    count: counts.scheduled },
                ].filter(p => p.key === null || p.count > 0).map(pill => (
                    <Pressable
                        key={String(pill.key)}
                        style={[styles.pill, filter === pill.key && styles.pillActive]}
                        onPress={() => setFilter(pill.key)}
                    >
                        <Text style={[
                            styles.pillText,
                            filter === pill.key && styles.pillTextActive,
                        ]}>
                            {pill.label} ({pill.count})
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading team...</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => String(item.user_id)}
                    renderItem={renderMember}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="moon-outline" size={40} color={colors.inputBorder} />
                            <Text style={styles.emptyTitle}>
                                {filter ? `No one is ${filter.replace('_', ' ')}` : 'No shifts today'}
                            </Text>
                            <Text style={styles.emptySub}>
                                {filter
                                    ? 'Try a different filter.'
                                    : 'No published shifts for today at this location.'}
                            </Text>
                        </View>
                    }
                    contentContainerStyle={[
                        styles.listContent,
                        filtered.length === 0 && { flex: 1 },
                    ]}
                    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                />
            )}
        </SafeAreaView>
    );
}

// ── Member card styles ────────────────────────────────────────────────────────

const memberStyles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#EFEFEF',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
        gap: 12,
    },
    avatarWrap: {
        position: 'relative',
        borderWidth: 2.5,
        borderRadius: 26,
        padding: 2,
        flexShrink: 0,
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText:  { fontSize: 15, fontWeight: '700' },
    dot: {
        position: 'absolute',
        bottom: 1,
        right: 1,
        width: 11,
        height: 11,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#fff',
    },
    info:      { flex: 1, minWidth: 0 },
    name:      { fontSize: 14, fontWeight: '700', color: colors.text },
    role:      { fontSize: 11, color: colors.gray, marginTop: 1 },
    shiftTime: { fontSize: 11, color: colors.gray, marginTop: 2 },
    right:     { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
    },
    statusText: { fontSize: 11, fontWeight: '700' },
    detail:     { fontSize: 11, color: colors.gray },
});

// ── Screen styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8F8FC' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backBtn:      { padding: 4, marginRight: 8 },
    headerCenter: { flex: 1 },
    headerTitle:  { fontSize: 18, fontWeight: '700', color: colors.text },
    headerSub:    { fontSize: 11, color: colors.gray, marginTop: 1 },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: '#10B98115',
    },
    liveDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981' },
    liveText: { fontSize: 12, color: '#10B981', fontWeight: '700' },

    summaryBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 14,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    summaryItem:  { alignItems: 'center', gap: 2 },
    summaryCount: { fontSize: 22, fontWeight: '800' },
    summaryLabel: { fontSize: 11, color: colors.gray },

    pillRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        flexWrap: 'wrap',
    },
    pill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        backgroundColor: '#FAFAFA',
    },
    pillActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
    pillText:       { fontSize: 12, color: colors.text, fontWeight: '600' },
    pillTextActive: { color: '#fff' },

    listContent:      { padding: 16 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    loadingText:      { fontSize: 13, color: colors.gray },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 40,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
    emptySub:   { fontSize: 13, color: colors.gray, textAlign: 'center' },
});