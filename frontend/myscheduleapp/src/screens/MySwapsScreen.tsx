// src/screens/MySwapsScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    RefreshControl,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { colors }       from '../theme/colors';
import { SwapsAPI }     from '../api/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type Swap = {
    swap_id:            number;
    shift_id:           number;
    requesting_user_id: number;
    receiving_user_id?: number | null;
    reason?:            string | null;
    status:             'pending' | 'accepted' | 'rejected' | 'approved' | 'cancelled';
    manager_approved?:  boolean | null;
    ai_suggested:       boolean;
    created_at:         string;
};

// ── Status config ─────────────────────────────────────────────────────────────

type StatusConfig = {
    label:  string;
    color:  string;
    icon:   React.ComponentProps<typeof Ionicons>['name'];
    bg:     string;
};

const STATUS_CONFIG: Record<string, StatusConfig> = {
    pending:   { label: 'Pending',          color: colors.warning, bg: colors.warning  + '18', icon: 'time-outline'             },
    accepted:  { label: 'Accepted',         color: colors.info,    bg: colors.info     + '18', icon: 'checkmark-outline'         },
    rejected:  { label: 'Declined',         color: colors.error,   bg: colors.error    + '18', icon: 'close-circle-outline'      },
    approved:  { label: 'Approved ✓',       color: colors.success, bg: colors.success  + '18', icon: 'shield-checkmark-outline'  },
    cancelled: { label: 'Cancelled',        color: colors.gray,    bg: '#F3F4F6',               icon: 'ban-outline'               },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
    const diff  = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins  / 60);
    const days  = Math.floor(hours / 24);
    if (mins  < 1)  return 'Just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MySwapsScreen({ navigation }: any) {
    const [swaps,      setSwaps]      = useState<Swap[]>([]);
    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchSwaps = useCallback(async () => {
        try {
            const { data } = await SwapsAPI.mySwaps();
            setSwaps(data?.swaps ?? []);
        } catch {
            Alert.alert('Error', 'Could not load swaps.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSwaps(); }, [fetchSwaps]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchSwaps();
        setRefreshing(false);
    }, [fetchSwaps]);

    // ── Accept a swap someone else requested ──────────────────────────────────
    const handleAccept = async (swap: Swap) => {
        Alert.alert(
            'Accept Swap',
            'Take over this shift? The manager will still need to approve.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Accept',
                    onPress: async () => {
                        try {
                            await SwapsAPI.accept(swap.swap_id);
                            await fetchSwaps();
                            Alert.alert('Accepted!', 'Waiting for manager approval.');
                        } catch (e: any) {
                            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to accept.');
                        }
                    },
                },
            ]
        );
    };

    // ── Render swap card ──────────────────────────────────────────────────────
    const renderSwap = ({ item }: { item: Swap }) => {
        const cfg      = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
        const isMine   = true; // from mySwaps endpoint — all are related to me
        const isPending = item.status === 'pending';
        const isAccepted = item.status === 'accepted';

        return (
            <View style={styles.swapCard}>
                {/* Top row */}
                <View style={styles.swapTop}>
                    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                        <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                        <Text style={[styles.statusText, { color: cfg.color }]}>
                            {cfg.label}
                        </Text>
                    </View>

                    {item.ai_suggested && (
                        <View style={styles.aiBadge}>
                            <Ionicons name="sparkles" size={12} color={colors.primary} />
                            <Text style={styles.aiBadgeText}>AI match</Text>
                        </View>
                    )}

                    <Text style={styles.timeAgo}>{timeAgo(item.created_at)}</Text>
                </View>

                {/* Shift ID reference */}
                <View style={styles.swapBody}>
                    <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                    <Text style={styles.swapBodyText}>
                        Shift #{item.shift_id}
                    </Text>
                </View>

                {/* Reason */}
                {item.reason ? (
                    <View style={styles.reasonRow}>
                        <Ionicons name="chatbubble-outline" size={14} color={colors.gray} />
                        <Text style={styles.reasonText} numberOfLines={2}>
                            {item.reason}
                        </Text>
                    </View>
                ) : null}

                {/* Progress steps */}
                <View style={styles.progressRow}>
                    <ProgressStep
                        label="Requested"
                        done
                        active={item.status === 'pending'}
                    />
                    <View style={styles.progressLine} />
                    <ProgressStep
                        label="Accepted"
                        done={['accepted', 'approved'].includes(item.status)}
                        active={item.status === 'accepted'}
                    />
                    <View style={styles.progressLine} />
                    <ProgressStep
                        label="Approved"
                        done={item.status === 'approved'}
                        active={item.status === 'approved'}
                    />
                </View>

                {/* Status message */}
                <Text style={styles.statusMsg}>
                    {item.status === 'pending'   && '⏳ Waiting for a colleague to accept your request.'}
                    {item.status === 'accepted'  && '✅ A colleague accepted. Waiting for manager approval.'}
                    {item.status === 'approved'  && '🎉 Swap complete! The shift has been reassigned.'}
                    {item.status === 'rejected'  && '❌ This swap was declined.'}
                    {item.status === 'cancelled' && '🚫 This swap was cancelled.'}
                </Text>
            </View>
        );
    };

    // ── Empty state ───────────────────────────────────────────────────────────
    const EmptyState = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="swap-horizontal-outline" size={48} color={colors.inputBorder} />
            <Text style={styles.emptyTitle}>No swap requests</Text>
            <Text style={styles.emptySubtitle}>
                Your shift swap requests will appear here.
            </Text>
            <Pressable
                style={styles.requestBtn}
                onPress={() => navigation.replace('SwapShift')}
            >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.requestBtnText}>Request a Swap</Text>
            </Pressable>
        </View>
    );

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>

            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>My Swap Requests</Text>
                <Pressable
                    onPress={() => navigation.navigate('SwapShift')}
                    style={styles.newBtn}
                >
                    <Ionicons name="add" size={20} color={colors.primary} />
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={swaps}
                    keyExtractor={item => String(item.swap_id)}
                    renderItem={renderSwap}
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
                        swaps.length === 0 && styles.listContentEmpty,
                    ]}
                    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                />
            )}
        </SafeAreaView>
    );
}

// ── ProgressStep sub-component ────────────────────────────────────────────────

function ProgressStep({
    label,
    done,
    active,
}: {
    label:  string;
    done:   boolean;
    active: boolean;
}) {
    const bg = done ? colors.primary : '#E5E7EB';

    return (
        <View style={progStyles.step}>
            <View style={[progStyles.dot, { backgroundColor: bg }]}>
                {done && <Ionicons name="checkmark" size={10} color="#fff" />}
            </View>
            <Text style={[progStyles.label, active && { color: colors.primary, fontWeight: '700' }]}>
                {label}
            </Text>
        </View>
    );
}

const progStyles = StyleSheet.create({
    step:  { alignItems: 'center', gap: 4 },
    dot: {
        width:          20,
        height:         20,
        borderRadius:   10,
        alignItems:     'center',
        justifyContent: 'center',
    },
    label: { fontSize: 10, color: colors.gray, textAlign: 'center' },
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:             { flex: 1, backgroundColor: '#F8F8FC' },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent:      { padding: 16 },
    listContentEmpty: { flex: 1 },

    header: {
        flexDirection:     'row',
        alignItems:        'center',
        paddingHorizontal: 16,
        paddingVertical:   12,
        backgroundColor:   '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backBtn:     { padding: 4, marginRight: 8 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
    newBtn: {
        width:           36,
        height:          36,
        borderRadius:    18,
        backgroundColor: colors.subtleAccent,
        alignItems:      'center',
        justifyContent:  'center',
    },

    swapCard: {
        backgroundColor: '#fff',
        borderRadius:    16,
        padding:         16,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        shadowColor:     '#000',
        shadowOpacity:   0.04,
        shadowRadius:    6,
        elevation:       2,
        gap:             12,
    },
    swapTop: {
        flexDirection: 'row',
        alignItems:    'center',
        gap:           8,
    },
    statusBadge: {
        flexDirection:     'row',
        alignItems:        'center',
        gap:               5,
        paddingHorizontal: 10,
        paddingVertical:    4,
        borderRadius:      999,
    },
    statusText: { fontSize: 12, fontWeight: '700' },
    aiBadge: {
        flexDirection:     'row',
        alignItems:        'center',
        gap:               4,
        paddingHorizontal: 8,
        paddingVertical:   3,
        borderRadius:      999,
        backgroundColor:   colors.subtleAccent,
        borderWidth:       1,
        borderColor:       colors.primary + '30',
    },
    aiBadgeText: { fontSize: 10, color: colors.primary, fontWeight: '700' },
    timeAgo:     { fontSize: 11, color: colors.gray, marginLeft: 'auto' },

    swapBody: {
        flexDirection: 'row',
        alignItems:    'center',
        gap:           8,
    },
    swapBodyText: { fontSize: 14, fontWeight: '600', color: colors.text },

    reasonRow: {
        flexDirection:   'row',
        alignItems:      'flex-start',
        gap:             6,
        backgroundColor: '#F9FAFB',
        borderRadius:    8,
        padding:         10,
    },
    reasonText: { flex: 1, fontSize: 13, color: colors.gray, lineHeight: 18 },

    progressRow: {
        flexDirection:  'row',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            0,
        paddingVertical: 4,
    },
    progressLine: {
        flex:            1,
        height:          2,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 4,
        marginBottom:    16,
    },

    statusMsg: {
        fontSize:   13,
        color:      colors.gray,
        lineHeight: 18,
        textAlign:  'center',
    },

    emptyContainer: {
        flex:           1,
        alignItems:     'center',
        justifyContent: 'center',
        gap:            12,
        padding:        40,
    },
    emptyTitle:    { fontSize: 18, fontWeight: '700', color: colors.text },
    emptySubtitle: { fontSize: 13, color: colors.gray, textAlign: 'center', lineHeight: 20 },
    requestBtn: {
        flexDirection:   'row',
        alignItems:      'center',
        gap:             6,
        marginTop:       8,
        paddingHorizontal: 20,
        paddingVertical:   12,
        borderRadius:    999,
        backgroundColor: colors.primary,
    },
    requestBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});