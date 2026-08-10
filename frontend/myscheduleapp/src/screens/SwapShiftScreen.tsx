// src/screens/SwapShiftScreen.tsx
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Pressable,
    TextInput, Alert, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { ShiftsAPI, SwapsAPI, DropsAPI, AdminAPI } from '../api/api';
import { AuthContext } from '../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type ShiftDetail = {
    shift_id: number;
    role?: string | null;
    start_time: string;
    end_time: string;
    break_minutes: number;
    status: string;
};

type TeamMember = {
    user_id: number;
    display_name: string | null;
    username: string;
    role?: string | null;
    emp_id: number;
};

type Tab = 'open' | 'targeted' | 'drop';

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

function calcDuration(start: string, end: string, brk: number) {
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
    const net = Math.max(diff - brk, 0);
    const h = Math.floor(net / 60);
    const m = net % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function isUpcoming(iso: string) {
    return new Date(iso) > new Date();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ShiftCard({
    shift, selected, onPress,
}: { shift: ShiftDetail; selected: boolean; onPress: () => void }) {
    return (
        <Pressable
            style={[sc.card, selected && sc.cardSelected]}
            onPress={onPress}
        >
            <View style={[sc.circle, selected && sc.circleActive]}>
                {selected && <Ionicons name="checkmark" size={12} color="#fff" />}
            </View>
            <View style={sc.info}>
                <Text style={sc.date}>{fmtDate(shift.start_time)}</Text>
                <Text style={sc.time}>{fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}</Text>
                <View style={sc.meta}>
                    {shift.role && <Text style={sc.metaText}>{shift.role}</Text>}
                    <Text style={sc.metaText}>{calcDuration(shift.start_time, shift.end_time, shift.break_minutes)}</Text>
                </View>
            </View>
            <Ionicons
                name={selected ? 'checkmark-circle' : 'chevron-forward'}
                size={20}
                color={selected ? colors.primary : colors.inputBorder}
            />
        </Pressable>
    );
}

const sc = StyleSheet.create({
    card: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#fff', borderRadius: 12, padding: 12,
        borderWidth: 2, borderColor: '#EFEFEF', marginBottom: 8,
    },
    cardSelected: { borderColor: colors.primary, backgroundColor: colors.subtleAccent },
    circle: {
        width: 22, height: 22, borderRadius: 11,
        borderWidth: 2, borderColor: colors.inputBorder,
        alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
    },
    circleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    info: { flex: 1 },
    date: { fontSize: 13, fontWeight: '700', color: colors.text },
    time: { fontSize: 12, color: colors.gray, marginTop: 1 },
    meta: { flexDirection: 'row', gap: 10, marginTop: 4 },
    metaText: { fontSize: 11, color: colors.gray },
});

// ── Main component ────────────────────────────────────────────────────────────

export default function SwapShiftScreen({ navigation }: any) {
    const { user: authUser } = useContext(AuthContext);

    const [tab, setTab] = useState<Tab>('open');
    const [myShifts, setMyShifts] = useState<ShiftDetail[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [colleagueShifts, setColleagueShifts] = useState<ShiftDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Selections
    const [myShift, setMyShift] = useState<ShiftDetail | null>(null);
    const [targetMember, setTargetMember] = useState<TeamMember | null>(null);
    const [theirShift, setTheirShift] = useState<ShiftDetail | null>(null);
    const [reason, setReason] = useState('');

    // Modals
    const [showColleagues, setShowColleagues] = useState(false);
    const [showTheirShifts, setShowTheirShifts] = useState(false);
    const [loadingColShifts, setLoadingColShifts] = useState(false);

    // ── Fetch my shifts ───────────────────────────────────────────────────────
    const fetchMyShifts = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await ShiftsAPI.mine();
            const upcoming = (data?.shifts ?? []).filter(
                (s: ShiftDetail) => s.status === 'published' && isUpcoming(s.start_time)
            );
            setMyShifts(upcoming);
        } catch {
            Alert.alert('Error', 'Could not load your shifts.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchMyShifts(); }, [fetchMyShifts]);

    // ── Fetch team members (for targeted) ─────────────────────────────────────
    const fetchTeam = useCallback(async () => {
        if (tab !== 'targeted') return;
        try {
            const { data } = await SwapsAPI.colleagues();
            setTeamMembers(data?.colleagues ?? []);
        } catch { }
    }, [tab]);

    useEffect(() => { fetchTeam(); }, [fetchTeam]);

    // ── Fetch a colleague's shifts ─────────────────────────────────────────────
    const fetchColleagueShifts = async (member: TeamMember) => {
        setTargetMember(member);
        setTheirShift(null);
        setLoadingColShifts(true);
        setShowColleagues(false);
        setShowTheirShifts(true);
        try {
            const { data } = await SwapsAPI.colleagueShifts(member.user_id);
            setColleagueShifts(data?.shifts ?? []);
        } catch {
            Alert.alert('Error', 'Could not load colleague shifts.');
        } finally {
            setLoadingColShifts(false);
        }
    };

    const switchTab = (t: Tab) => {
        setTab(t);
        setMyShift(null);
        setTargetMember(null);
        setTheirShift(null);
        setReason('');
    };

    // ── Submit open swap ──────────────────────────────────────────────────────
    const handleOpenSwap = async () => {
        if (!myShift) return;
        Alert.alert(
            'Post Open Swap',
            `Post your ${fmtDate(myShift.start_time)} shift to the swap marketplace?\n\nColleagues will see it and can offer one of their shifts in return.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Post Swap',
                    onPress: async () => {
                        setSubmitting(true);
                        try {
                            await SwapsAPI.requestOpen(myShift.shift_id, reason.trim() || undefined);
                            Alert.alert('Posted ✓', 'Your shift is now in the swap marketplace. Colleagues will be notified.');
                            navigation.navigate('MySwaps');
                        } catch (e: any) {
                            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to post swap.');
                        } finally {
                            setSubmitting(false);
                        }
                    },
                },
            ]
        );
    };

    // ── Submit targeted swap ──────────────────────────────────────────────────
    const handleTargetedSwap = async () => {
        if (!myShift || !targetMember || !theirShift) return;
        Alert.alert(
            'Send Swap Request',
            `Offer your ${fmtDate(myShift.start_time)} shift to ${targetMember.display_name || targetMember.username} in exchange for their ${fmtDate(theirShift.start_time)} shift?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send Request',
                    onPress: async () => {
                        setSubmitting(true);
                        try {
                            await SwapsAPI.requestTargeted({
                                shift_id: myShift.shift_id,
                                receiving_user_id: targetMember.user_id,
                                offered_shift_id: theirShift.shift_id,
                                reason: reason.trim() || undefined,
                            });
                            Alert.alert('Sent ✓', `${targetMember.display_name || targetMember.username} has been notified and must accept the swap.`);
                            navigation.navigate('MySwaps');
                        } catch (e: any) {
                            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to send swap.');
                        } finally {
                            setSubmitting(false);
                        }
                    },
                },
            ]
        );
    };

    // ── Submit drop ───────────────────────────────────────────────────────────
    const handleDrop = async () => {
        if (!myShift) return;
        Alert.alert(
            'Drop Shift',
            `Hand back your ${fmtDate(myShift.start_time)} shift to your manager?\n\nYour manager must approve and will reassign it.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Drop Shift',
                    style: 'destructive',
                    onPress: async () => {
                        setSubmitting(true);
                        try {
                            await DropsAPI.request(myShift.shift_id, reason.trim() || undefined);
                            Alert.alert('Requested ✓', 'Your manager has been notified.');
                            navigation.goBack();
                        } catch (e: any) {
                            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to submit.');
                        } finally {
                            setSubmitting(false);
                        }
                    },
                },
            ]
        );
    };

    const accentColor = tab === 'drop' ? colors.error : colors.primary;
    const canSubmit = tab === 'open'
        ? !!myShift
        : tab === 'targeted'
            ? !!myShift && !!targetMember && !!theirShift
            : !!myShift;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Shift Actions</Text>
                <Pressable onPress={() => navigation.navigate('MySwaps')} style={styles.historyBtn}>
                    <Text style={styles.historyBtnText}>History</Text>
                </Pressable>
            </View>

            {/* Tabs */}
            <View style={styles.tabBar}>
                {([
                    { key: 'open', label: 'Open Swap', icon: 'globe-outline' },
                    { key: 'targeted', label: 'Direct Swap', icon: 'swap-horizontal' },
                    { key: 'drop', label: 'Drop Shift', icon: 'arrow-down-circle-outline' },
                ] as { key: Tab; label: string; icon: any }[]).map(t => (
                    <Pressable
                        key={t.key}
                        style={[
                            styles.tab,
                            tab === t.key && {
                                ...styles.tabActive,
                                borderBottomColor: t.key === 'drop' ? colors.error : colors.primary,
                            },
                        ]}
                        onPress={() => switchTab(t.key)}
                    >
                        <Ionicons
                            name={t.icon}
                            size={14}
                            color={tab === t.key ? (t.key === 'drop' ? colors.error : colors.primary) : colors.gray}
                        />
                        <Text style={[
                            styles.tabText,
                            tab === t.key && {
                                color: t.key === 'drop' ? colors.error : colors.primary,
                                fontWeight: '700',
                            },
                        ]}>
                            {t.label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

                {/* Info banner */}
                <View style={[styles.banner, { backgroundColor: accentColor + '10', borderColor: accentColor + '25' }]}>
                    <Ionicons name="information-circle-outline" size={15} color={accentColor} />
                    <Text style={[styles.bannerText, { color: accentColor }]}>
                        {tab === 'open'
                            ? 'Post your shift to the marketplace. Colleagues can browse and offer one of their shifts in return. You decide which offer to accept.'
                            : tab === 'targeted'
                                ? 'Pick a specific colleague and the shift you want from them. Both parties and the manager must agree.'
                                : 'Hand your shift back to your manager. They will need to approve and reassign it.'}
                    </Text>
                </View>

                {/* Step 1 — My shift */}
                <View style={styles.stepRow}>
                    <View style={[styles.stepBadge, { backgroundColor: accentColor }]}>
                        <Text style={styles.stepNum}>1</Text>
                    </View>
                    <Text style={styles.stepLabel}>
                        {tab === 'open' ? 'Select the shift you want to post' : 'Select your shift to swap'}
                    </Text>
                </View>

                {loading ? (
                    <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
                ) : myShifts.length === 0 ? (
                    <View style={styles.empty}>
                        <Ionicons name="calendar-outline" size={36} color={colors.inputBorder} />
                        <Text style={styles.emptyText}>No upcoming shifts</Text>
                    </View>
                ) : (
                    myShifts.map(s => (
                        <ShiftCard
                            key={s.shift_id}
                            shift={s}
                            selected={myShift?.shift_id === s.shift_id}
                            onPress={() => setMyShift(myShift?.shift_id === s.shift_id ? null : s)}
                        />
                    ))
                )}

                {/* Step 2 — Targeted only: pick colleague */}
                {tab === 'targeted' && myShift && (
                    <>
                        <View style={[styles.stepRow, { marginTop: 20 }]}>
                            <View style={[styles.stepBadge, { backgroundColor: accentColor }]}>
                                <Text style={styles.stepNum}>2</Text>
                            </View>
                            <Text style={styles.stepLabel}>Pick a colleague</Text>
                        </View>

                        <Pressable
                            style={styles.selectorBtn}
                            onPress={() => setShowColleagues(true)}
                        >
                            <Ionicons name="person-outline" size={18} color={colors.primary} />
                            <Text style={styles.selectorBtnText}>
                                {targetMember
                                    ? targetMember.display_name || targetMember.username
                                    : 'Select colleague...'}
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.gray} />
                        </Pressable>

                        {/* Step 3 — Pick their shift */}
                        {targetMember && (
                            <>
                                <View style={[styles.stepRow, { marginTop: 20 }]}>
                                    <View style={[styles.stepBadge, { backgroundColor: accentColor }]}>
                                        <Text style={styles.stepNum}>3</Text>
                                    </View>
                                    <Text style={styles.stepLabel}>
                                        Pick which of {targetMember.display_name || targetMember.username}'s shifts you want
                                    </Text>
                                </View>

                                <Pressable
                                    style={styles.selectorBtn}
                                    onPress={() => setShowTheirShifts(true)}
                                >
                                    <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                                    <Text style={styles.selectorBtnText}>
                                        {theirShift
                                            ? `${fmtDate(theirShift.start_time)} ${fmtTime(theirShift.start_time)}`
                                            : 'Select their shift...'}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={16} color={colors.gray} />
                                </Pressable>
                            </>
                        )}
                    </>
                )}

                {/* Reason */}
                {myShift && (tab !== 'targeted' || (targetMember && theirShift)) && (
                    <>
                        <View style={[styles.stepRow, { marginTop: 20 }]}>
                            <View style={[styles.stepBadge, { backgroundColor: accentColor }]}>
                                <Text style={styles.stepNum}>{tab === 'targeted' ? '4' : '2'}</Text>
                            </View>
                            <Text style={styles.stepLabel}>Reason (optional)</Text>
                        </View>
                        <View style={styles.reasonCard}>
                            <TextInput
                                style={styles.reasonInput}
                                value={reason}
                                onChangeText={setReason}
                                placeholder="e.g. Family emergency, appointment..."
                                placeholderTextColor={colors.gray}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                                maxLength={200}
                            />
                            <Text style={styles.charCount}>{reason.length}/200</Text>
                        </View>
                    </>
                )}

                {/* Summary */}
                {canSubmit && (
                    <View style={[styles.summary, { backgroundColor: accentColor + '10', borderColor: accentColor + '25' }]}>
                        <Ionicons name={tab === 'drop' ? 'warning-outline' : 'swap-horizontal'} size={16} color={accentColor} />
                        <Text style={styles.summaryText}>
                            {tab === 'open' && `Your ${fmtDate(myShift!.start_time)} shift will be posted to the marketplace.`}
                            {tab === 'targeted' && `You'll swap your ${fmtDate(myShift!.start_time)} shift for ${targetMember?.display_name || targetMember?.username}'s ${fmtDate(theirShift!.start_time)} shift.`}
                            {tab === 'drop' && `You'll request to hand back your ${fmtDate(myShift!.start_time)} shift.`}
                        </Text>
                    </View>
                )}

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Submit button */}
            {canSubmit && (
                <View style={styles.footer}>
                    <Pressable
                        style={[styles.submitBtn, { backgroundColor: accentColor }, submitting && { opacity: 0.6 }]}
                        onPress={tab === 'open' ? handleOpenSwap : tab === 'targeted' ? handleTargetedSwap : handleDrop}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons
                                    name={tab === 'drop' ? 'arrow-down-circle-outline' : 'swap-horizontal'}
                                    size={20} color="#fff"
                                />
                                <Text style={styles.submitBtnText}>
                                    {tab === 'open' ? 'Post to Marketplace' : tab === 'targeted' ? 'Send Swap Request' : 'Request Drop'}
                                </Text>
                            </>
                        )}
                    </Pressable>
                </View>
            )}

            {/* Colleague picker modal */}
            <Modal visible={showColleagues} transparent animationType="slide" onRequestClose={() => setShowColleagues(false)}>
                <Pressable style={styles.overlay} onPress={() => setShowColleagues(false)}>
                    <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>Pick a Colleague</Text>
                        <FlatList
                            data={teamMembers}
                            keyExtractor={m => String(m.user_id)}
                            renderItem={({ item }) => (
                                <Pressable
                                    style={styles.memberRow}
                                    onPress={() => fetchColleagueShifts(item)}
                                >
                                    <View style={styles.memberAvatar}>
                                        <Text style={styles.memberAvatarText}>
                                            {(item.display_name || item.username)[0].toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={styles.memberInfo}>
                                        <Text style={styles.memberName}>{item.display_name || item.username}</Text>
                                        {item.role && <Text style={styles.memberRole}>{item.role}</Text>}
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color={colors.gray} />
                                </Pressable>
                            )}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>No colleagues found.</Text>
                            }
                        />
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Their shifts modal */}
            <Modal visible={showTheirShifts} transparent animationType="slide" onRequestClose={() => setShowTheirShifts(false)}>
                <Pressable style={styles.overlay} onPress={() => setShowTheirShifts(false)}>
                    <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>
                            {targetMember?.display_name || targetMember?.username}'s Upcoming Shifts
                        </Text>
                        {loadingColShifts ? (
                            <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
                        ) : (
                            <FlatList
                                data={colleagueShifts}
                                keyExtractor={s => String(s.shift_id)}
                                renderItem={({ item }) => (
                                    <ShiftCard
                                        shift={item}
                                        selected={theirShift?.shift_id === item.shift_id}
                                        onPress={() => {
                                            setTheirShift(item);
                                            setShowTheirShifts(false);
                                        }}
                                    />
                                )}
                                ListEmptyComponent={
                                    <View style={styles.empty}>
                                        <Text style={styles.emptyText}>No upcoming shifts found for this colleague.</Text>
                                    </View>
                                }
                                contentContainerStyle={{ padding: 4 }}
                            />
                        )}
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8F8FC' },
    scroll: { flex: 1 },
    content: { padding: 16 },

    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    backBtn: { padding: 4, marginRight: 8 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
    historyBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.subtleAccent },
    historyBtnText: { fontSize: 12, color: colors.primary, fontWeight: '700' },

    tabBar: {
        flexDirection: 'row', backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    tab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 4, paddingVertical: 11,
        borderBottomWidth: 2, borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: colors.primary },
    tabText: { fontSize: 11, fontWeight: '600', color: colors.gray },

    banner: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 16,
    },
    bannerText: { flex: 1, fontSize: 12, lineHeight: 18 },

    stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    stepBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    stepNum: { color: '#fff', fontSize: 12, fontWeight: '800' },
    stepLabel: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 },

    selectorBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#fff', borderRadius: 12, padding: 14,
        borderWidth: 1.5, borderColor: colors.primary + '40',
        marginBottom: 4,
    },
    selectorBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },

    empty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
    emptyText: { fontSize: 13, color: colors.gray, textAlign: 'center' },

    reasonCard: {
        backgroundColor: '#fff', borderRadius: 12, padding: 12,
        borderWidth: 1, borderColor: '#EFEFEF', marginBottom: 12,
    },
    reasonInput: { fontSize: 14, color: colors.text, minHeight: 72, lineHeight: 22 },
    charCount: { fontSize: 11, color: colors.gray, textAlign: 'right', marginTop: 4 },

    summary: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 4,
    },
    summaryText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 },

    footer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: 16, paddingBottom: 32,
        backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0',
    },
    submitBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, borderRadius: 999, paddingVertical: 14,
    },
    submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 20, maxHeight: '75%',
    },
    sheetHandle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 16,
    },
    sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 16 },

    memberRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
    },
    memberAvatar: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.primary + '20',
        alignItems: 'center', justifyContent: 'center',
    },
    memberAvatarText: { fontSize: 16, fontWeight: '700', color: colors.primary },
    memberInfo: { flex: 1 },
    memberName: { fontSize: 14, fontWeight: '600', color: colors.text },
    memberRole: { fontSize: 12, color: colors.gray, marginTop: 2 },
});