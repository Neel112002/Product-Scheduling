// src/screens/SwapShiftScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    TextInput,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { colors }       from '../theme/colors';
import { ShiftsAPI, SwapsAPI } from '../api/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type ShiftDetail = {
    shift_id:      number;
    location_id:   number;
    role?:         string | null;
    start_time:    string;
    end_time:      string;
    break_minutes: number;
    status:        string;
    assignments:   { user_id: number }[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatShiftDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-CA', {
        weekday: 'long',
        month:   'short',
        day:     'numeric',
    });
}

function formatShiftTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-CA', {
        hour:    '2-digit',
        minute:  '2-digit',
        hour12:  true,
    });
}

function calcDuration(start: string, end: string, breakMins: number): string {
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
    const net  = Math.max(diff - breakMins, 0);
    const h    = Math.floor(net / 60);
    const m    = net % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function isUpcoming(iso: string): boolean {
    return new Date(iso) > new Date();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SwapShiftScreen({ navigation }: any) {
    const [myShifts,     setMyShifts]     = useState<ShiftDetail[]>([]);
    const [loading,      setLoading]      = useState(true);
    const [selectedShift, setSelectedShift] = useState<ShiftDetail | null>(null);
    const [reason,       setReason]       = useState('');
    const [submitting,   setSubmitting]   = useState(false);

    // ── Fetch my upcoming published shifts ────────────────────────────────────
    const fetchShifts = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await ShiftsAPI.mine();
            const upcoming = (data?.shifts ?? []).filter(
                (s: ShiftDetail) =>
                    s.status === 'published' && isUpcoming(s.start_time)
            );
            setMyShifts(upcoming);
        } catch {
            Alert.alert('Error', 'Could not load your shifts.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchShifts(); }, [fetchShifts]);

    // ── Submit swap request ───────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!selectedShift) {
            Alert.alert('Select a shift', 'Please select the shift you want to swap.');
            return;
        }

        Alert.alert(
            'Request Swap',
            `Request a swap for your shift on ${formatShiftDate(selectedShift.start_time)}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send Request',
                    onPress: async () => {
                        setSubmitting(true);
                        try {
                            await SwapsAPI.request(
                                selectedShift.shift_id,
                                reason.trim() || undefined,
                            );
                            Alert.alert(
                                'Swap Requested ✓',
                                'Your swap request has been sent to your teammates. You\'ll be notified when someone accepts.',
                                [{
                                    text: 'View My Swaps',
                                    onPress: () => navigation.replace('MySwaps'),
                                }]
                            );
                        } catch (e: any) {
                            const msg = e?.response?.data?.error ?? 'Failed to send swap request.';
                            Alert.alert('Error', msg);
                        } finally {
                            setSubmitting(false);
                        }
                    },
                },
            ]
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>

            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Request Swap</Text>
                <Pressable
                    onPress={() => navigation.navigate('MySwaps')}
                    style={styles.mySwapsBtn}
                >
                    <Text style={styles.mySwapsBtnText}>My Swaps</Text>
                </Pressable>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                {/* Step 1 — Select shift */}
                <View style={styles.stepHeader}>
                    <View style={styles.stepBadge}>
                        <Text style={styles.stepBadgeText}>1</Text>
                    </View>
                    <Text style={styles.stepTitle}>Select the shift you want to swap</Text>
                </View>

                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator color={colors.primary} />
                        <Text style={styles.loadingText}>Loading your shifts...</Text>
                    </View>
                ) : myShifts.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Ionicons name="calendar-outline" size={40} color={colors.inputBorder} />
                        <Text style={styles.emptyTitle}>No upcoming shifts</Text>
                        <Text style={styles.emptySubtitle}>
                            You don't have any upcoming published shifts to swap.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.shiftList}>
                        {myShifts.map(shift => {
                            const selected = selectedShift?.shift_id === shift.shift_id;
                            return (
                                <Pressable
                                    key={shift.shift_id}
                                    style={[
                                        styles.shiftCard,
                                        selected && styles.shiftCardSelected,
                                    ]}
                                    onPress={() => setSelectedShift(
                                        selected ? null : shift
                                    )}
                                >
                                    {/* Selection indicator */}
                                    <View style={[
                                        styles.selectCircle,
                                        selected && styles.selectCircleActive,
                                    ]}>
                                        {selected && (
                                            <Ionicons name="checkmark" size={14} color="#fff" />
                                        )}
                                    </View>

                                    {/* Shift info */}
                                    <View style={styles.shiftInfo}>
                                        <Text style={styles.shiftDate}>
                                            {formatShiftDate(shift.start_time)}
                                        </Text>
                                        <Text style={styles.shiftTime}>
                                            {formatShiftTime(shift.start_time)} – {formatShiftTime(shift.end_time)}
                                        </Text>
                                        <View style={styles.shiftMeta}>
                                            {shift.role && (
                                                <View style={styles.metaChip}>
                                                    <Ionicons name="briefcase-outline" size={12} color={colors.gray} />
                                                    <Text style={styles.metaText}>{shift.role}</Text>
                                                </View>
                                            )}
                                            <View style={styles.metaChip}>
                                                <Ionicons name="hourglass-outline" size={12} color={colors.gray} />
                                                <Text style={styles.metaText}>
                                                    {calcDuration(shift.start_time, shift.end_time, shift.break_minutes)}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Arrow */}
                                    <Ionicons
                                        name={selected ? 'checkmark-circle' : 'chevron-forward'}
                                        size={20}
                                        color={selected ? colors.primary : colors.inputBorder}
                                    />
                                </Pressable>
                            );
                        })}
                    </View>
                )}

                {/* Step 2 — Reason (only show if shift selected) */}
                {selectedShift && (
                    <>
                        <View style={[styles.stepHeader, { marginTop: 24 }]}>
                            <View style={styles.stepBadge}>
                                <Text style={styles.stepBadgeText}>2</Text>
                            </View>
                            <Text style={styles.stepTitle}>Reason (optional)</Text>
                        </View>

                        <View style={styles.reasonCard}>
                            <TextInput
                                style={styles.reasonInput}
                                value={reason}
                                onChangeText={setReason}
                                placeholder="e.g. Doctor's appointment, family event..."
                                placeholderTextColor={colors.gray}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                                maxLength={200}
                            />
                            <Text style={styles.charCount}>{reason.length}/200</Text>
                        </View>

                        {/* Selected shift summary */}
                        <View style={styles.summaryCard}>
                            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                            <Text style={styles.summaryText}>
                                Your swap request for{' '}
                                <Text style={{ fontWeight: '700' }}>
                                    {formatShiftDate(selectedShift.start_time)}
                                </Text>
                                {' '}({formatShiftTime(selectedShift.start_time)} – {formatShiftTime(selectedShift.end_time)})
                                {' '}will be sent to all available teammates.
                            </Text>
                        </View>
                    </>
                )}

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Submit button */}
            {selectedShift && (
                <View style={styles.footer}>
                    <Pressable
                        style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="swap-horizontal" size={20} color="#fff" />
                                <Text style={styles.submitBtnText}>Send Swap Request</Text>
                            </>
                        )}
                    </Pressable>
                </View>
            )}
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:    { flex: 1, backgroundColor: '#F8F8FC' },
    scroll:  { flex: 1 },
    content: { padding: 16 },

    header: {
        flexDirection:     'row',
        alignItems:        'center',
        paddingHorizontal: 16,
        paddingVertical:   12,
        backgroundColor:   '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backBtn:        { padding: 4, marginRight: 8 },
    headerTitle:    { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
    mySwapsBtn:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.subtleAccent },
    mySwapsBtnText: { fontSize: 12, color: colors.primary, fontWeight: '700' },

    stepHeader: {
        flexDirection: 'row',
        alignItems:    'center',
        gap:           10,
        marginBottom:  12,
    },
    stepBadge: {
        width:           26,
        height:          26,
        borderRadius:    13,
        backgroundColor: colors.primary,
        alignItems:      'center',
        justifyContent:  'center',
    },
    stepBadgeText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    stepTitle:     { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },

    loadingBox: {
        alignItems:    'center',
        paddingVertical: 40,
        gap:           10,
    },
    loadingText: { fontSize: 13, color: colors.gray },

    emptyBox: {
        alignItems:    'center',
        paddingVertical: 40,
        gap:           8,
    },
    emptyTitle:    { fontSize: 16, fontWeight: '700', color: colors.text },
    emptySubtitle: { fontSize: 13, color: colors.gray, textAlign: 'center' },

    shiftList: { gap: 10 },
    shiftCard: {
        flexDirection:   'row',
        alignItems:      'center',
        backgroundColor: '#fff',
        borderRadius:    14,
        padding:         14,
        borderWidth:     2,
        borderColor:     '#EFEFEF',
        gap:             12,
        shadowColor:     '#000',
        shadowOpacity:   0.03,
        shadowRadius:    4,
        elevation:       1,
    },
    shiftCardSelected: {
        borderColor:     colors.primary,
        backgroundColor: colors.subtleAccent,
    },

    selectCircle: {
        width:           24,
        height:          24,
        borderRadius:    12,
        borderWidth:     2,
        borderColor:     colors.inputBorder,
        alignItems:      'center',
        justifyContent:  'center',
        backgroundColor: '#fff',
    },
    selectCircleActive: {
        backgroundColor: colors.primary,
        borderColor:     colors.primary,
    },

    shiftInfo: { flex: 1 },
    shiftDate: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
    shiftTime: { fontSize: 13, color: colors.gray, marginBottom: 6 },
    shiftMeta: { flexDirection: 'row', gap: 10 },
    metaChip:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText:  { fontSize: 12, color: colors.gray },

    reasonCard: {
        backgroundColor: '#fff',
        borderRadius:    14,
        padding:         14,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        marginBottom:    12,
    },
    reasonInput: {
        fontSize:    14,
        color:       colors.text,
        minHeight:   80,
        lineHeight:  22,
    },
    charCount: {
        fontSize:  11,
        color:     colors.gray,
        textAlign: 'right',
        marginTop: 4,
    },

    summaryCard: {
        flexDirection:   'row',
        alignItems:      'flex-start',
        gap:             8,
        backgroundColor: colors.subtleAccent,
        borderRadius:    12,
        padding:         12,
        borderWidth:     1,
        borderColor:     colors.primary + '20',
    },
    summaryText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 },

    footer: {
        position:        'absolute',
        bottom:          0,
        left:            0,
        right:           0,
        padding:         16,
        paddingBottom:   32,
        backgroundColor: '#fff',
        borderTopWidth:  1,
        borderTopColor:  '#F0F0F0',
    },
    submitBtn: {
        flexDirection:   'row',
        alignItems:      'center',
        justifyContent:  'center',
        gap:             8,
        backgroundColor: colors.primary,
        borderRadius:    999,
        paddingVertical: 14,
    },
    submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});