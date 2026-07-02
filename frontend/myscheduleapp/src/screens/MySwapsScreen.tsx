// src/screens/MySwapsScreen.tsx
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, Pressable,
    RefreshControl, ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { colors }       from '../theme/colors';
import { SwapsAPI }     from '../api/api';
import { AuthContext }  from '../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type ShiftInfo = {
    shift_id:      number;
    start_time:    string;
    end_time:      string;
    break_minutes: number;
    role?:         string | null;
    location?:     string | null;
};

type UserInfo = {
    user_id: number;
    name:    string | null;
};

type Swap = {
    swap_id:          number;
    swap_type:        'open' | 'targeted';
    status:           string;
    reason?:          string | null;
    manager_approved?: boolean | null;
    ai_suggested:     boolean;
    created_at:       string;
    requester:        UserInfo;
    receiver?:        UserInfo | null;
    shift:            ShiftInfo | null;
    offered_shift?:   ShiftInfo | null;
};

type MyShift = {
    shift_id:      number;
    start_time:    string;
    end_time:      string;
    break_minutes: number;
    role?:         string | null;
};

type Tab = 'mine' | 'incoming' | 'marketplace';

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
    pending:       { label: 'Open',            color: '#6366F1', bg: '#6366F115' },
    offer_pending: { label: 'Offer Pending',   color: '#F59E0B', bg: '#F59E0B15' },
    accepted:      { label: 'Awaiting Manager',color: colors.info,    bg: colors.info + '15'    },
    approved:      { label: 'Approved ✓',      color: colors.success, bg: colors.success + '15' },
    rejected:      { label: 'Rejected',        color: colors.error,   bg: colors.error + '15'   },
    cancelled:     { label: 'Cancelled',       color: colors.gray,    bg: '#F3F4F615'            },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-CA', {
        weekday: 'short', month: 'short', day: 'numeric',
    });
}
function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function timeAgo(iso: string) {
    const diff  = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);
    if (mins  < 1)  return 'Just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

function ShiftChip({ shift, label, color }: { shift: ShiftInfo; label: string; color: string }) {
    return (
        <View style={[chipSt.wrap, { borderColor: color + '30', backgroundColor: color + '08' }]}>
            <Text style={[chipSt.label, { color }]}>{label}</Text>
            <Text style={chipSt.date}>{fmtDate(shift.start_time)}</Text>
            <Text style={chipSt.time}>{fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}</Text>
            {shift.role && <Text style={chipSt.role}>{shift.role}</Text>}
        </View>
    );
}
const chipSt = StyleSheet.create({
    wrap:  { borderRadius: 10, borderWidth: 1, padding: 10, flex: 1 },
    label: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
    date:  { fontSize: 13, fontWeight: '700', color: colors.text },
    time:  { fontSize: 11, color: colors.gray, marginTop: 2 },
    role:  { fontSize: 11, color: colors.gray, marginTop: 1 },
});

// ── Main component ────────────────────────────────────────────────────────────

export default function MySwapsScreen({ navigation }: any) {
    const { user: authUser } = useContext(AuthContext);

    const [tab,          setTab]          = useState<Tab>('mine');
    const [mySwaps,      setMySwaps]      = useState<Swap[]>([]);
    const [incoming,     setIncoming]     = useState<Swap[]>([]);
    const [marketplace,  setMarketplace]  = useState<Swap[]>([]);
    const [myShifts,     setMyShifts]     = useState<MyShift[]>([]);
    const [loading,      setLoading]      = useState(true);
    const [refreshing,   setRefreshing]   = useState(false);
    const [acting,       setActing]       = useState<number | null>(null);

    // Offer modal
    const [offerSwap,    setOfferSwap]    = useState<Swap | null>(null);
    const [offerShift,   setOfferShift]   = useState<MyShift | null>(null);
    const [showOffer,    setShowOffer]    = useState(false);
    const [submittingOffer, setSubmittingOffer] = useState(false);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        try {
            const [mineRes, incomingRes, marketRes, myShiftsRes] = await Promise.allSettled([
                SwapsAPI.mySwaps(),
                SwapsAPI.incoming(),
                SwapsAPI.marketplace(),
                SwapsAPI.myShiftsForOffer(),
            ]);
            if (mineRes.status     === 'fulfilled') setMySwaps(mineRes.value.data?.swaps ?? []);
            if (incomingRes.status === 'fulfilled') setIncoming(incomingRes.value.data?.swaps ?? []);
            if (marketRes.status   === 'fulfilled') setMarketplace(marketRes.value.data?.swaps ?? []);
            if (myShiftsRes.status === 'fulfilled') setMyShifts(myShiftsRes.value.data?.shifts ?? []);
        } catch {
            Alert.alert('Error', 'Could not load swaps.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchAll();
        setRefreshing(false);
    }, [fetchAll]);

    // ── Actions ───────────────────────────────────────────────────────────────

    const handleCancel = async (swap: Swap) => {
        Alert.alert('Cancel Swap', 'Remove this swap request?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Yes, Cancel',
                style: 'destructive',
                onPress: async () => {
                    setActing(swap.swap_id);
                    try {
                        await SwapsAPI.cancel(swap.swap_id);
                        await fetchAll();
                    } catch (e: any) {
                        Alert.alert('Error', e?.response?.data?.error ?? 'Failed.');
                    } finally {
                        setActing(null);
                    }
                },
            },
        ]);
    };

    const handleAcceptOffer = async (swap: Swap) => {
        Alert.alert(
            'Accept Offer',
            `Accept ${swap.receiver?.name}'s offer of their ${fmtDate(swap.offered_shift!.start_time)} shift?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Accept',
                    onPress: async () => {
                        setActing(swap.swap_id);
                        try {
                            await SwapsAPI.accept(swap.swap_id);
                            await fetchAll();
                            Alert.alert('Accepted ✓', 'Waiting for manager approval.');
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

    const handleRejectOffer = async (swap: Swap) => {
        setActing(swap.swap_id);
        try {
            await SwapsAPI.reject(swap.swap_id);
            await fetchAll();
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Failed.');
        } finally {
            setActing(null);
        }
    };

    const handleAcceptTargeted = async (swap: Swap) => {
        Alert.alert(
            'Accept Swap',
            `Swap your ${fmtDate(swap.offered_shift!.start_time)} shift for ${swap.requester.name}'s ${fmtDate(swap.shift!.start_time)} shift?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Accept',
                    onPress: async () => {
                        setActing(swap.swap_id);
                        try {
                            await SwapsAPI.accept(swap.swap_id);
                            await fetchAll();
                            Alert.alert('Accepted ✓', 'Waiting for manager approval.');
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

    const handleRejectTargeted = async (swap: Swap) => {
        setActing(swap.swap_id);
        try {
            await SwapsAPI.reject(swap.swap_id);
            await fetchAll();
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Failed.');
        } finally {
            setActing(null);
        }
    };

    const openOfferModal = (swap: Swap) => {
        setOfferSwap(swap);
        setOfferShift(null);
        setShowOffer(true);
    };

    const handleSubmitOffer = async () => {
        if (!offerSwap || !offerShift) return;
        setSubmittingOffer(true);
        try {
            await SwapsAPI.makeOffer(offerSwap.swap_id, offerShift.shift_id);
            setShowOffer(false);
            await fetchAll();
            Alert.alert('Offer Sent ✓', 'The requester will review your offer.');
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to make offer.');
        } finally {
            setSubmittingOffer(false);
        }
    };

    // ── Render swap card ──────────────────────────────────────────────────────

    const renderMineCard = ({ item: swap }: { item: Swap }) => {
        const cfg     = STATUS_CFG[swap.status] ?? STATUS_CFG.pending;
        const isBusy  = acting === swap.swap_id;

        return (
            <View style={styles.card}>
                <View style={styles.cardTop}>
                    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                        <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <View style={[styles.typePill, { backgroundColor: swap.swap_type === 'open' ? '#6366F115' : colors.primary + '15' }]}>
                        <Text style={[styles.typeText, { color: swap.swap_type === 'open' ? '#6366F1' : colors.primary }]}>
                            {swap.swap_type === 'open' ? 'Open' : 'Targeted'}
                        </Text>
                    </View>
                    <Text style={styles.timeAgo}>{timeAgo(swap.created_at)}</Text>
                </View>

                <View style={styles.shiftRow}>
                    {swap.shift && (
                        <ShiftChip shift={swap.shift} label="YOUR SHIFT" color={colors.primary} />
                    )}
                    {swap.offered_shift && (
                        <>
                            <Ionicons name="swap-horizontal" size={18} color={colors.gray} />
                            <ShiftChip shift={swap.offered_shift} label="IN RETURN" color={colors.success} />
                        </>
                    )}
                </View>

                {swap.receiver && (
                    <Text style={styles.withText}>
                        {swap.status === 'offer_pending'
                            ? `⏳ ${swap.receiver.name} offered a shift — review it`
                            : `↔ With ${swap.receiver.name}`}
                    </Text>
                )}

                {swap.reason && <Text style={styles.reason}>"{swap.reason}"</Text>}

                {/* Progress */}
                <View style={styles.progress}>
                    {[
                        { label: 'Posted',   done: true },
                        { label: 'Accepted', done: ['accepted','approved'].includes(swap.status) },
                        { label: 'Approved', done: swap.status === 'approved' },
                    ].map((step, i, arr) => (
                        <React.Fragment key={step.label}>
                            <View style={styles.progStep}>
                                <View style={[styles.progDot, step.done && { backgroundColor: colors.primary }]}>
                                    {step.done && <Ionicons name="checkmark" size={9} color="#fff" />}
                                </View>
                                <Text style={styles.progLabel}>{step.label}</Text>
                            </View>
                            {i < arr.length - 1 && (
                                <View style={[styles.progLine, arr[i+1].done && { backgroundColor: colors.primary }]} />
                            )}
                        </React.Fragment>
                    ))}
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                    {swap.status === 'offer_pending' && (
                        <>
                            <Pressable
                                style={[styles.actionBtn, { backgroundColor: colors.success }]}
                                onPress={() => handleAcceptOffer(swap)}
                                disabled={isBusy}
                            >
                                <Text style={styles.actionBtnText}>Accept Offer</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.actionBtn, { backgroundColor: colors.error }]}
                                onPress={() => handleRejectOffer(swap)}
                                disabled={isBusy}
                            >
                                <Text style={styles.actionBtnText}>Decline</Text>
                            </Pressable>
                        </>
                    )}
                    {['pending', 'offer_pending'].includes(swap.status) && (
                        <Pressable
                            style={[styles.actionBtnOutline]}
                            onPress={() => handleCancel(swap)}
                            disabled={isBusy}
                        >
                            {isBusy
                                ? <ActivityIndicator size="small" color={colors.error} />
                                : <Text style={[styles.actionBtnOutlineText, { color: colors.error }]}>Cancel</Text>
                            }
                        </Pressable>
                    )}
                </View>
            </View>
        );
    };

    const renderIncomingCard = ({ item: swap }: { item: Swap }) => {
        const cfg    = STATUS_CFG[swap.status] ?? STATUS_CFG.pending;
        const isBusy = acting === swap.swap_id;
        const isTargeted = swap.swap_type === 'targeted';

        return (
            <View style={styles.card}>
                <View style={styles.cardTop}>
                    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                        <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <Text style={styles.timeAgo}>{timeAgo(swap.created_at)}</Text>
                </View>

                <Text style={styles.fromText}>
                    {isTargeted
                        ? `📨 ${swap.requester.name} wants to swap directly with you`
                        : `✋ You offered for ${swap.requester.name}'s open swap`}
                </Text>

                <View style={styles.shiftRow}>
                    {swap.shift && (
                        <ShiftChip shift={swap.shift} label={isTargeted ? "THEY GIVE UP" : "THEIR SHIFT"} color={colors.primary} />
                    )}
                    {swap.offered_shift && (
                        <>
                            <Ionicons name="swap-horizontal" size={18} color={colors.gray} />
                            <ShiftChip shift={swap.offered_shift} label={isTargeted ? "YOU GIVE UP" : "YOUR OFFER"} color={colors.warning} />
                        </>
                    )}
                </View>

                {swap.reason && <Text style={styles.reason}>"{swap.reason}"</Text>}

                {/* Actions for targeted pending */}
                {isTargeted && swap.status === 'pending' && (
                    <View style={styles.actions}>
                        <Pressable
                            style={[styles.actionBtn, { backgroundColor: colors.success }]}
                            onPress={() => handleAcceptTargeted(swap)}
                            disabled={isBusy}
                        >
                            {isBusy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.actionBtnText}>Accept Swap</Text>}
                        </Pressable>
                        <Pressable
                            style={[styles.actionBtn, { backgroundColor: colors.error }]}
                            onPress={() => handleRejectTargeted(swap)}
                            disabled={isBusy}
                        >
                            <Text style={styles.actionBtnText}>Decline</Text>
                        </Pressable>
                    </View>
                )}
            </View>
        );
    };

    const renderMarketCard = ({ item: swap }: { item: Swap }) => (
        <View style={styles.card}>
            <View style={styles.cardTop}>
                <View style={[styles.badge, { backgroundColor: '#6366F115' }]}>
                    <Text style={[styles.badgeText, { color: '#6366F1' }]}>Open Swap</Text>
                </View>
                <Text style={styles.timeAgo}>{timeAgo(swap.created_at)}</Text>
            </View>

            <Text style={styles.fromText}>🔄 {swap.requester.name} is looking to swap</Text>

            {swap.shift && (
                <ShiftChip shift={swap.shift} label="THEIR SHIFT (OFFERED)" color={colors.primary} />
            )}

            {swap.reason && <Text style={styles.reason}>"{swap.reason}"</Text>}

            <Text style={styles.offerHint}>
                Offer one of your shifts in return. The requester picks which offer to accept.
            </Text>

            <Pressable
                style={[styles.actionBtn, { backgroundColor: colors.primary, marginTop: 4 }]}
                onPress={() => openOfferModal(swap)}
            >
                <Ionicons name="swap-horizontal" size={15} color="#fff" />
                <Text style={styles.actionBtnText}>Offer My Shift</Text>
            </Pressable>
        </View>
    );

    const currentData = tab === 'mine' ? mySwaps : tab === 'incoming' ? incoming : marketplace;
    const renderItem  = tab === 'mine' ? renderMineCard : tab === 'incoming' ? renderIncomingCard : renderMarketCard;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Swap Requests</Text>
                <Pressable onPress={() => navigation.navigate('SwapShift')} style={styles.newBtn}>
                    <Ionicons name="add" size={20} color={colors.primary} />
                </Pressable>
            </View>

            {/* Tabs */}
            <View style={styles.tabBar}>
                {([
                    { key: 'mine',        label: 'Mine',        count: mySwaps.filter(s => ['pending','offer_pending'].includes(s.status)).length },
                    { key: 'incoming',    label: 'Incoming',    count: incoming.filter(s => s.status === 'pending').length },
                    { key: 'marketplace', label: 'Marketplace', count: marketplace.length },
                ] as { key: Tab; label: string; count: number }[]).map(t => (
                    <Pressable
                        key={t.key}
                        style={[styles.tab, tab === t.key && styles.tabActive]}
                        onPress={() => setTab(t.key)}
                    >
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
                </View>
            ) : (
                <FlatList
                    data={currentData as any[]}
                    keyExtractor={item => String(item.swap_id)}
                    renderItem={renderItem as any}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="swap-horizontal-outline" size={48} color={colors.inputBorder} />
                            <Text style={styles.emptyTitle}>
                                {tab === 'mine' ? 'No swap requests' : tab === 'incoming' ? 'No incoming requests' : 'No open swaps'}
                            </Text>
                            <Text style={styles.emptySub}>
                                {tab === 'marketplace' ? 'No colleagues have posted open swaps yet.' : ''}
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

            {/* Offer modal */}
            <Modal visible={showOffer} transparent animationType="slide" onRequestClose={() => setShowOffer(false)}>
                <Pressable style={styles.overlay} onPress={() => setShowOffer(false)}>
                    <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>Offer One of Your Shifts</Text>
                        {offerSwap?.shift && (
                            <View style={{ marginBottom: 16 }}>
                                <Text style={styles.sheetSub}>In exchange for:</Text>
                                <ShiftChip shift={offerSwap.shift} label="THEIR SHIFT" color={colors.primary} />
                            </View>
                        )}
                        <Text style={styles.sheetSub}>Select your shift to offer:</Text>
                        <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                            {myShifts.length === 0 ? (
                                <Text style={styles.emptySub}>No available shifts to offer.</Text>
                            ) : myShifts.map(s => (
                                <Pressable
                                    key={s.shift_id}
                                    style={[styles.offerShiftRow, offerShift?.shift_id === s.shift_id && styles.offerShiftRowActive]}
                                    onPress={() => setOfferShift(s)}
                                >
                                    <View style={[styles.offerCircle, offerShift?.shift_id === s.shift_id && styles.offerCircleActive]}>
                                        {offerShift?.shift_id === s.shift_id && <Ionicons name="checkmark" size={12} color="#fff" />}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.offerShiftDate}>{fmtDate(s.start_time)}</Text>
                                        <Text style={styles.offerShiftTime}>{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</Text>
                                        {s.role && <Text style={styles.offerShiftRole}>{s.role}</Text>}
                                    </View>
                                </Pressable>
                            ))}
                        </ScrollView>
                        <Pressable
                            style={[styles.submitOfferBtn, (!offerShift || submittingOffer) && { opacity: 0.6 }]}
                            onPress={handleSubmitOffer}
                            disabled={!offerShift || submittingOffer}
                        >
                            {submittingOffer
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={styles.submitOfferBtnText}>Send Offer</Text>
                            }
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:             { flex: 1, backgroundColor: '#F8F8FC' },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent:      { padding: 16 },

    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    backBtn:     { padding: 4, marginRight: 8 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
    newBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.subtleAccent,
        alignItems: 'center', justifyContent: 'center',
    },

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
    tabText:       { fontSize: 13, fontWeight: '600', color: colors.gray },
    tabTextActive: { color: colors.primary },
    tabBadge: {
        backgroundColor: colors.primary, borderRadius: 999,
        paddingHorizontal: 5, paddingVertical: 1,
    },
    tabBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },

    card: {
        backgroundColor: '#fff', borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: '#EFEFEF',
        shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
        gap: 10,
    },
    cardTop:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
    badge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    badgeText:  { fontSize: 11, fontWeight: '700' },
    typePill:   { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
    typeText:   { fontSize: 10, fontWeight: '700' },
    timeAgo:    { fontSize: 11, color: colors.gray, marginLeft: 'auto' },

    shiftRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
    fromText:   { fontSize: 13, fontWeight: '600', color: colors.text },
    reason:     { fontSize: 12, color: colors.gray, fontStyle: 'italic' },
    offerHint:  { fontSize: 12, color: colors.gray, lineHeight: 18 },
    withText:   { fontSize: 12, color: colors.gray },

    progress: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'center', paddingTop: 4,
    },
    progStep:  { alignItems: 'center', gap: 4 },
    progDot: {
        width: 18, height: 18, borderRadius: 9,
        backgroundColor: '#E5E7EB',
        alignItems: 'center', justifyContent: 'center',
    },
    progLine:  { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginHorizontal: 4, marginBottom: 16 },
    progLabel: { fontSize: 9, color: colors.gray },

    actions:          { flexDirection: 'row', gap: 8 },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 9, borderRadius: 999,
    },
    actionBtnText:    { color: '#fff', fontSize: 13, fontWeight: '700' },
    actionBtnOutline: {
        flex: 1, alignItems: 'center', paddingVertical: 9,
        borderRadius: 999, borderWidth: 1.5, borderColor: colors.error + '50',
    },
    actionBtnOutlineText: { fontSize: 13, fontWeight: '700' },

    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
    emptyTitle:     { fontSize: 16, fontWeight: '700', color: colors.text },
    emptySub:       { fontSize: 13, color: colors.gray, textAlign: 'center' },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 20, maxHeight: '80%',
    },
    sheetHandle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 16,
    },
    sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
    sheetSub:   { fontSize: 13, color: colors.gray, marginBottom: 10 },

    offerShiftRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
        borderRadius: 10,
    },
    offerShiftRowActive: { backgroundColor: colors.subtleAccent },
    offerCircle: {
        width: 22, height: 22, borderRadius: 11,
        borderWidth: 2, borderColor: colors.inputBorder,
        alignItems: 'center', justifyContent: 'center',
    },
    offerCircleActive:  { backgroundColor: colors.primary, borderColor: colors.primary },
    offerShiftDate:     { fontSize: 13, fontWeight: '700', color: colors.text },
    offerShiftTime:     { fontSize: 12, color: colors.gray, marginTop: 1 },
    offerShiftRole:     { fontSize: 11, color: colors.gray },
    submitOfferBtn: {
        marginTop: 16, paddingVertical: 14, borderRadius: 999,
        backgroundColor: colors.primary, alignItems: 'center',
    },
    submitOfferBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});