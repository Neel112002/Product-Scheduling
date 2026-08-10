// src/screens/admin/AdminRequestsScreen.tsx
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, Pressable,
    RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { colors }       from '../../theme/colors';
import { SwapsAPI, DropsAPI, TimeOffAPI, AdminAPI } from '../../api/api';
import { AuthContext }  from '../../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type ShiftInfo = {
    shift_id:      number;
    start_time:    string;
    end_time:      string;
    break_minutes: number;
    role?:         string | null;
};

type Swap = {
    swap_id:        number;
    swap_type:      string;
    status:         string;
    reason?:        string | null;
    requester:      { user_id: number; name: string | null };
    receiver?:      { user_id: number; name: string | null } | null;
    shift:          ShiftInfo | null;
    offered_shift?: ShiftInfo | null;
    conflicts?:     { requester: any[]; receiver: any[] };
};

type Drop = {
    drop_id:   number;
    shift_id:  number;
    user_id:   number;
    reason?:   string | null;
    status:    string;
    created_at: string;
    shift?: {
        start_time:    string;
        end_time:      string;
        role?:         string | null;
        break_minutes: number;
    } | null;
};

type TimeOff = {
    request_id:   number;
    user_id:      number;
    start_date:   string;
    end_date:     string;
    days:         number;
    request_type: string;
    reason?:      string | null;
    status:       string;
    created_at:   string;
};

type Tab = 'swaps' | 'drops' | 'timeoff';

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
    vacation: '🏖 Vacation',
    sick:     '🤒 Sick Leave',
    personal: '👤 Personal',
    other:    '📋 Other',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-CA', {
        weekday: 'short', month: 'short', day: 'numeric',
    });
}

function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-CA', {
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
}

function fmtDateOnly(iso: string) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-CA', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
}

function timeAgo(iso: string) {
    const diff  = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminRequestsScreen({ route, navigation }: any) {
    const { user: authUser } = useContext(AuthContext);

    const [tab,         setTab]         = useState<Tab>('swaps');
    const [swaps,       setSwaps]       = useState<Swap[]>([]);
    const [drops,       setDrops]       = useState<Drop[]>([]);
    const [timeoffs,    setTimeoffs]    = useState<TimeOff[]>([]);
    const [locationId,  setLocationId]  = useState<number | null>(
        route?.params?.locationId ?? authUser?.primaryLocation?.id ?? null
    );
    const [loading,     setLoading]     = useState(true);
    const [refreshing,  setRefreshing]  = useState(false);
    const [acting,      setActing]      = useState<string | null>(null);

    // Resolve locationId if missing
    useEffect(() => {
        if (locationId) return;
        AdminAPI.listLocations().then(({ data }) => {
            const locs = data?.locations ?? [];
            if (locs.length) setLocationId(locs[0].id);
        }).catch(() => {});
    }, [locationId]);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        if (!locationId) return;
        try {
            const [swapsRes, dropsRes, timeoffRes] = await Promise.allSettled([
                SwapsAPI.pendingManager(locationId),
                DropsAPI.pendingDrops(locationId),
                TimeOffAPI.pending(),
            ]);
            if (swapsRes.status   === 'fulfilled') setSwaps(swapsRes.value.data?.swaps ?? []);
            if (dropsRes.status   === 'fulfilled') setDrops(dropsRes.value.data?.drops ?? []);
            if (timeoffRes.status === 'fulfilled') setTimeoffs(timeoffRes.value.data?.requests ?? []);
        } catch {
            Alert.alert('Error', 'Could not load requests.');
        } finally {
            setLoading(false);
        }
    }, [locationId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchAll();
        setRefreshing(false);
    }, [fetchAll]);

    // ── Swap decide ───────────────────────────────────────────────────────────
    const decideSwap = (swap: Swap, approve: boolean) => {
        const action = approve ? 'Approve' : 'Reject';
        const hasConflicts = (swap.conflicts?.requester?.length ?? 0) + (swap.conflicts?.receiver?.length ?? 0) > 0;

        Alert.alert(
            `${action} Swap`,
            approve && hasConflicts
                ? `⚠️ There are scheduling conflicts. Are you sure you want to approve?`
                : `${action} the swap between ${swap.requester.name} and ${swap.receiver?.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: action,
                    style: approve ? 'default' : 'destructive',
                    onPress: async () => {
                        setActing(`swap-${swap.swap_id}`);
                        try {
                            await SwapsAPI.managerDecide(swap.swap_id, approve);
                            await fetchAll();
                        } catch (e: any) {
                            Alert.alert('Error', e?.response?.data?.error ?? 'Failed.');
                        } finally {
                            setActing(null);
                        }
                    },
                },
            ]
        );
    };

    // ── Drop decide ───────────────────────────────────────────────────────────
    const decideDrop = (drop: Drop, approve: boolean) => {
        Alert.alert(
            approve ? 'Approve Drop' : 'Reject Drop',
            approve
                ? `Approve the drop request? The shift will become unassigned.`
                : `Reject the drop request? The employee will remain assigned.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: approve ? 'Approve' : 'Reject',
                    style: approve ? 'default' : 'destructive',
                    onPress: async () => {
                        setActing(`drop-${drop.drop_id}`);
                        try {
                            await DropsAPI.decide(drop.drop_id, approve);
                            await fetchAll();
                        } catch (e: any) {
                            Alert.alert('Error', e?.response?.data?.error ?? 'Failed.');
                        } finally {
                            setActing(null);
                        }
                    },
                },
            ]
        );
    };

    // ── Time off decide ───────────────────────────────────────────────────────
    const decideTimeOff = (req: TimeOff, approve: boolean) => {
        Alert.alert(
            approve ? 'Approve Time Off' : 'Reject Time Off',
            `${approve ? 'Approve' : 'Reject'} time off from ${fmtDateOnly(req.start_date)} to ${fmtDateOnly(req.end_date)}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: approve ? 'Approve' : 'Reject',
                    style: approve ? 'default' : 'destructive',
                    onPress: async () => {
                        setActing(`timeoff-${req.request_id}`);
                        try {
                            await TimeOffAPI.decide(req.request_id, approve);
                            await fetchAll();
                        } catch (e: any) {
                            Alert.alert('Error', e?.response?.data?.error ?? 'Failed.');
                        } finally {
                            setActing(null);
                        }
                    },
                },
            ]
        );
    };

    // ── Render swap card ──────────────────────────────────────────────────────
    const renderSwap = ({ item: swap }: { item: Swap }) => {
        const isBusy = acting === `swap-${swap.swap_id}`;
        const reqConflicts = swap.conflicts?.requester ?? [];
        const recConflicts = swap.conflicts?.receiver  ?? [];
        const hasConflicts = reqConflicts.length > 0 || recConflicts.length > 0;

        return (
            <View style={styles.card}>
                {/* Header */}
                <View style={styles.cardHeader}>
                    <View style={styles.cardBadgeRow}>
                        <View style={[styles.typeBadge, { backgroundColor: '#6366F115' }]}>
                            <Ionicons name="swap-horizontal" size={12} color="#6366F1" />
                            <Text style={[styles.typeBadgeText, { color: '#6366F1' }]}>
                                {swap.swap_type === 'open' ? 'Open Swap' : 'Direct Swap'}
                            </Text>
                        </View>
                        {hasConflicts && (
                            <View style={[styles.typeBadge, { backgroundColor: colors.error + '15' }]}>
                                <Ionicons name="warning-outline" size={12} color={colors.error} />
                                <Text style={[styles.typeBadgeText, { color: colors.error }]}>Conflict</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.cardTime}>{timeAgo(swap.shift?.start_time ?? '')}</Text>
                </View>

                {/* Exchange */}
                <View style={styles.exchangeRow}>
                    {/* Requester side */}
                    <View style={styles.exchangeSide}>
                        <Text style={styles.exchangeName}>{swap.requester.name}</Text>
                        {swap.shift && (
                            <View style={styles.shiftBox}>
                                <Text style={styles.shiftBoxDate}>{fmtDate(swap.shift.start_time)}</Text>
                                <Text style={styles.shiftBoxTime}>
                                    {fmtTime(swap.shift.start_time)} – {fmtTime(swap.shift.end_time)}
                                </Text>
                                {swap.shift.role && <Text style={styles.shiftBoxRole}>{swap.shift.role}</Text>}
                            </View>
                        )}
                        {reqConflicts.length > 0 && (
                            <View style={styles.conflictBanner}>
                                <Ionicons name="alert-circle" size={12} color={colors.error} />
                                <Text style={styles.conflictText}>
                                    Conflicts with {reqConflicts.length} other shift{reqConflicts.length > 1 ? 's' : ''}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.exchangeArrow}>
                        <Ionicons name="swap-horizontal" size={22} color={colors.gray} />
                    </View>

                    {/* Receiver side */}
                    <View style={styles.exchangeSide}>
                        <Text style={styles.exchangeName}>{swap.receiver?.name ?? '—'}</Text>
                        {swap.offered_shift && (
                            <View style={styles.shiftBox}>
                                <Text style={styles.shiftBoxDate}>{fmtDate(swap.offered_shift.start_time)}</Text>
                                <Text style={styles.shiftBoxTime}>
                                    {fmtTime(swap.offered_shift.start_time)} – {fmtTime(swap.offered_shift.end_time)}
                                </Text>
                                {swap.offered_shift.role && (
                                    <Text style={styles.shiftBoxRole}>{swap.offered_shift.role}</Text>
                                )}
                            </View>
                        )}
                        {recConflicts.length > 0 && (
                            <View style={styles.conflictBanner}>
                                <Ionicons name="alert-circle" size={12} color={colors.error} />
                                <Text style={styles.conflictText}>
                                    Conflicts with {recConflicts.length} other shift{recConflicts.length > 1 ? 's' : ''}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {swap.reason && <Text style={styles.reason}>"{swap.reason}"</Text>}

                {/* Conflict detail */}
                {hasConflicts && (
                    <View style={styles.conflictDetail}>
                        <Ionicons name="warning" size={14} color={colors.error} />
                        <Text style={styles.conflictDetailText}>
                            Approving this swap may cause scheduling conflicts. Review carefully.
                        </Text>
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actions}>
                    <Pressable
                        style={[styles.rejectBtn, isBusy && { opacity: 0.5 }]}
                        onPress={() => decideSwap(swap, false)}
                        disabled={isBusy}
                    >
                        <Ionicons name="close" size={16} color={colors.error} />
                        <Text style={styles.rejectBtnText}>Reject</Text>
                    </Pressable>
                    <Pressable
                        style={[
                            styles.approveBtn,
                            hasConflicts && { backgroundColor: colors.warning },
                            isBusy && { opacity: 0.5 },
                        ]}
                        onPress={() => decideSwap(swap, true)}
                        disabled={isBusy}
                    >
                        {isBusy
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <>
                                <Ionicons name="checkmark" size={16} color="#fff" />
                                <Text style={styles.approveBtnText}>
                                    {hasConflicts ? 'Approve Anyway' : 'Approve'}
                                </Text>
                            </>
                        }
                    </Pressable>
                </View>
            </View>
        );
    };

    // ── Render drop card ──────────────────────────────────────────────────────
    const renderDrop = ({ item: drop }: { item: Drop }) => {
        const isBusy = acting === `drop-${drop.drop_id}`;
        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={[styles.typeBadge, { backgroundColor: colors.error + '15' }]}>
                        <Ionicons name="arrow-down-circle-outline" size={12} color={colors.error} />
                        <Text style={[styles.typeBadgeText, { color: colors.error }]}>Drop Request</Text>
                    </View>
                    <Text style={styles.cardTime}>{timeAgo(drop.created_at)}</Text>
                </View>

                <Text style={styles.employeeName}>Employee #{drop.user_id}</Text>

                {drop.shift && (
                    <View style={[styles.shiftBox, { alignSelf: 'flex-start', minWidth: '60%' }]}>
                        <Text style={styles.shiftBoxDate}>{fmtDate(drop.shift.start_time)}</Text>
                        <Text style={styles.shiftBoxTime}>
                            {fmtTime(drop.shift.start_time)} – {fmtTime(drop.shift.end_time)}
                        </Text>
                        {drop.shift.role && <Text style={styles.shiftBoxRole}>{drop.shift.role}</Text>}
                    </View>
                )}

                {drop.reason && <Text style={styles.reason}>"{drop.reason}"</Text>}

                <Text style={styles.dropNote}>
                    If approved, this shift will become unassigned and must be reassigned manually.
                </Text>

                <View style={styles.actions}>
                    <Pressable
                        style={[styles.rejectBtn, isBusy && { opacity: 0.5 }]}
                        onPress={() => decideDrop(drop, false)}
                        disabled={isBusy}
                    >
                        <Ionicons name="close" size={16} color={colors.error} />
                        <Text style={styles.rejectBtnText}>Reject</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.approveBtn, isBusy && { opacity: 0.5 }]}
                        onPress={() => decideDrop(drop, true)}
                        disabled={isBusy}
                    >
                        {isBusy
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <>
                                <Ionicons name="checkmark" size={16} color="#fff" />
                                <Text style={styles.approveBtnText}>Approve</Text>
                            </>
                        }
                    </Pressable>
                </View>
            </View>
        );
    };

    // ── Render time off card ──────────────────────────────────────────────────
    const renderTimeOff = ({ item: req }: { item: TimeOff }) => {
        const isBusy = acting === `timeoff-${req.request_id}`;
        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={[styles.typeBadge, { backgroundColor: '#6366F115' }]}>
                        <Ionicons name="calendar-outline" size={12} color="#6366F1" />
                        <Text style={[styles.typeBadgeText, { color: '#6366F1' }]}>
                            {TYPE_LABELS[req.request_type] ?? req.request_type}
                        </Text>
                    </View>
                    <Text style={styles.cardTime}>{timeAgo(req.created_at)}</Text>
                </View>

                <Text style={styles.employeeName}>Employee #{req.user_id}</Text>

                <View style={styles.dateRange}>
                    <View style={styles.dateChip}>
                        <Text style={styles.dateChipLabel}>FROM</Text>
                        <Text style={styles.dateChipValue}>{fmtDateOnly(req.start_date)}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={colors.gray} />
                    <View style={styles.dateChip}>
                        <Text style={styles.dateChipLabel}>TO</Text>
                        <Text style={styles.dateChipValue}>{fmtDateOnly(req.end_date)}</Text>
                    </View>
                    <View style={[styles.dateChip, { backgroundColor: colors.primary + '12' }]}>
                        <Text style={[styles.dateChipLabel, { color: colors.primary }]}>DAYS</Text>
                        <Text style={[styles.dateChipValue, { color: colors.primary }]}>{req.days}</Text>
                    </View>
                </View>

                {req.reason && <Text style={styles.reason}>"{req.reason}"</Text>}

                <View style={styles.actions}>
                    <Pressable
                        style={[styles.rejectBtn, isBusy && { opacity: 0.5 }]}
                        onPress={() => decideTimeOff(req, false)}
                        disabled={isBusy}
                    >
                        <Ionicons name="close" size={16} color={colors.error} />
                        <Text style={styles.rejectBtnText}>Reject</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.approveBtn, isBusy && { opacity: 0.5 }]}
                        onPress={() => decideTimeOff(req, true)}
                        disabled={isBusy}
                    >
                        {isBusy
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <>
                                <Ionicons name="checkmark" size={16} color="#fff" />
                                <Text style={styles.approveBtnText}>Approve</Text>
                            </>
                        }
                    </Pressable>
                </View>
            </View>
        );
    };

    const currentData = tab === 'swaps' ? swaps : tab === 'drops' ? drops : timeoffs;
    const renderItem  = tab === 'swaps' ? renderSwap : tab === 'drops' ? renderDrop : renderTimeOff;
    const totalPending = swaps.length + drops.length + timeoffs.length;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Pending Requests</Text>
                    {totalPending > 0 && (
                        <Text style={styles.headerSub}>{totalPending} awaiting review</Text>
                    )}
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabBar}>
                {([
                    { key: 'swaps',   label: 'Swaps',    count: swaps.length,    icon: 'swap-horizontal'          },
                    { key: 'drops',   label: 'Drops',    count: drops.length,    icon: 'arrow-down-circle-outline'},
                    { key: 'timeoff', label: 'Time Off', count: timeoffs.length, icon: 'calendar-outline'         },
                ] as { key: Tab; label: string; count: number; icon: any }[]).map(t => (
                    <Pressable
                        key={t.key}
                        style={[styles.tab, tab === t.key && styles.tabActive]}
                        onPress={() => setTab(t.key)}
                    >
                        <Ionicons
                            name={t.icon}
                            size={14}
                            color={tab === t.key ? colors.primary : colors.gray}
                        />
                        <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                            {t.label}
                        </Text>
                        {t.count > 0 && (
                            <View style={styles.tabBadge}>
                                <Text style={styles.tabBadgeText}>{t.count}</Text>
                            </View>
                        )}
                    </Pressable>
                ))}
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading requests...</Text>
                </View>
            ) : (
                <FlatList
                    data={currentData as any[]}
                    keyExtractor={(item: any) =>
                        String(item.swap_id ?? item.drop_id ?? item.request_id)
                    }
                    renderItem={renderItem as any}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="checkmark-circle-outline" size={52} color={colors.success} />
                            <Text style={styles.emptyTitle}>All caught up!</Text>
                            <Text style={styles.emptySub}>
                                No pending {tab === 'swaps' ? 'swap' : tab === 'drops' ? 'drop' : 'time off'} requests.
                            </Text>
                        </View>
                    }
                    contentContainerStyle={[
                        styles.listContent,
                        currentData.length === 0 && { flex: 1 },
                    ]}
                    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                />
            )}
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:             { flex: 1, backgroundColor: '#F8F8FC' },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    loadingText:      { fontSize: 13, color: colors.gray },
    listContent:      { padding: 16 },

    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    backBtn:     { padding: 4, marginRight: 8 },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    headerSub:   { fontSize: 11, color: colors.warning, fontWeight: '600', marginTop: 1 },

    tabBar: {
        flexDirection: 'row', backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    tab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 5, paddingVertical: 12,
        borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    tabActive:     { borderBottomColor: colors.primary },
    tabText:       { fontSize: 12, fontWeight: '600', color: colors.gray },
    tabTextActive: { color: colors.primary },
    tabBadge: {
        backgroundColor: colors.error, borderRadius: 999,
        paddingHorizontal: 5, paddingVertical: 1,
    },
    tabBadgeText: { fontSize: 9, color: '#fff', fontWeight: '800' },

    // Card
    card: {
        backgroundColor: '#fff', borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: '#EFEFEF',
        shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
        gap: 10,
    },
    cardHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardBadgeRow: { flexDirection: 'row', gap: 6 },
    cardTime:     { fontSize: 11, color: colors.gray },
    typeBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    },
    typeBadgeText: { fontSize: 10, fontWeight: '700' },

    // Exchange (swap)
    exchangeRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    exchangeSide: { flex: 1, gap: 6 },
    exchangeName: { fontSize: 13, fontWeight: '700', color: colors.text },
    exchangeArrow:{ alignItems: 'center', justifyContent: 'center', paddingTop: 28 },

    shiftBox: {
        backgroundColor: '#F8F8FC', borderRadius: 8,
        padding: 8, borderWidth: 1, borderColor: '#EFEFEF',
    },
    shiftBoxDate: { fontSize: 12, fontWeight: '700', color: colors.text },
    shiftBoxTime: { fontSize: 11, color: colors.gray, marginTop: 2 },
    shiftBoxRole: { fontSize: 11, color: colors.primary, marginTop: 2 },

    conflictBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: colors.error + '10', borderRadius: 6,
        paddingHorizontal: 8, paddingVertical: 4,
    },
    conflictText: { fontSize: 11, color: colors.error, fontWeight: '600' },

    conflictDetail: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 6,
        backgroundColor: colors.error + '08', borderRadius: 8,
        padding: 10, borderWidth: 1, borderColor: colors.error + '20',
    },
    conflictDetailText: { flex: 1, fontSize: 12, color: colors.error, lineHeight: 18 },

    employeeName: { fontSize: 14, fontWeight: '700', color: colors.text },
    reason:       { fontSize: 12, color: colors.gray, fontStyle: 'italic' },
    dropNote:     { fontSize: 12, color: colors.gray, lineHeight: 18 },

    // Date range (time off)
    dateRange: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dateChip: {
        backgroundColor: '#F3F4F6', borderRadius: 8,
        paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center',
    },
    dateChipLabel: { fontSize: 9, fontWeight: '800', color: colors.gray, letterSpacing: 0.5 },
    dateChipValue: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 2 },

    // Action buttons
    actions: { flexDirection: 'row', gap: 8 },
    rejectBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 5, paddingVertical: 10, borderRadius: 999,
        borderWidth: 1.5, borderColor: colors.error + '50',
    },
    rejectBtnText:  { fontSize: 13, fontWeight: '700', color: colors.error },
    approveBtn: {
        flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 5, paddingVertical: 10, borderRadius: 999,
        backgroundColor: colors.success,
    },
    approveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
    emptyTitle:     { fontSize: 16, fontWeight: '700', color: colors.text },
    emptySub:       { fontSize: 13, color: colors.gray, textAlign: 'center' },
});