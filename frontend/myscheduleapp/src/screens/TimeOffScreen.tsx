// src/screens/TimeOffScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Pressable,
    Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { colors }       from '../theme/colors';
import { TimeOffAPI }   from '../api/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type RequestType = 'vacation' | 'sick' | 'personal' | 'other';

type TimeOffRequest = {
    request_id:    number;
    user_id:       number;
    start_date:    string;
    end_date:      string;
    days:          number;
    request_type:  RequestType;
    reason?:       string | null;
    status:        string;
    manager_notes?: string | null;
    created_at:    string;
};

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<RequestType, { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
    vacation: { label: 'Vacation',     icon: 'airplane-outline',    color: '#6366F1' },
    sick:     { label: 'Sick Leave',   icon: 'medkit-outline',      color: '#EF4444' },
    personal: { label: 'Personal',     icon: 'person-outline',      color: '#F59E0B' },
    other:    { label: 'Other',        icon: 'ellipsis-horizontal', color: '#6B7280' },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
    pending:   { color: '#F59E0B', bg: '#F59E0B15', label: 'Pending'   },
    approved:  { color: '#10B981', bg: '#10B98115', label: 'Approved'  },
    rejected:  { color: '#EF4444', bg: '#EF444415', label: 'Rejected'  },
    cancelled: { color: '#9CA3AF', bg: '#9CA3AF15', label: 'Cancelled' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-CA', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
}

function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

function today(): string {
    return new Date().toISOString().split('T')[0];
}

function diffDays(start: string, end: string): number {
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end   + 'T00:00:00');
    return Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
}

// Simple date grid picker
function DatePicker({
    value, minDate, onChange,
}: { value: string; minDate?: string; onChange: (v: string) => void }) {
    const [viewDate, setViewDate] = useState(() => {
        const d = new Date(value + 'T00:00:00');
        return { year: d.getFullYear(), month: d.getMonth() };
    });

    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const { year, month } = viewDate;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const prevMonth = () => {
        setViewDate(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
    };
    const nextMonth = () => {
        setViewDate(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 });
    };

    return (
        <View style={dp.wrap}>
            <View style={dp.nav}>
                <Pressable onPress={prevMonth} style={dp.navBtn}>
                    <Ionicons name="chevron-back" size={18} color={colors.text} />
                </Pressable>
                <Text style={dp.navTitle}>{MONTH_NAMES[month]} {year}</Text>
                <Pressable onPress={nextMonth} style={dp.navBtn}>
                    <Ionicons name="chevron-forward" size={18} color={colors.text} />
                </Pressable>
            </View>
            <View style={dp.grid}>
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                    <Text key={d} style={dp.weekday}>{d}</Text>
                ))}
                {cells.map((day, i) => {
                    if (!day) return <View key={`e${i}`} style={dp.cell} />;
                    const iso      = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const selected = iso === value;
                    const disabled = minDate ? iso < minDate : false;
                    return (
                        <Pressable
                            key={iso}
                            style={[dp.cell, selected && dp.cellSelected, disabled && dp.cellDisabled]}
                            onPress={() => !disabled && onChange(iso)}
                        >
                            <Text style={[dp.cellText, selected && dp.cellTextSelected, disabled && dp.cellTextDisabled]}>
                                {day}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const dp = StyleSheet.create({
    wrap:          { backgroundColor: '#FAFAFA', borderRadius: 12, padding: 12, marginTop: 8 },
    nav:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    navBtn:        { padding: 6 },
    navTitle:      { fontSize: 14, fontWeight: '700', color: colors.text },
    grid:          { flexDirection: 'row', flexWrap: 'wrap' },
    weekday:       { width: '14.28%', textAlign: 'center', fontSize: 11, color: colors.gray, fontWeight: '600', marginBottom: 4 },
    cell:          { width: '14.28%', alignItems: 'center', paddingVertical: 5 },
    cellSelected:  { backgroundColor: colors.primary, borderRadius: 999 },
    cellDisabled:  { opacity: 0.3 },
    cellText:      { fontSize: 13, color: colors.text },
    cellTextSelected: { color: '#fff', fontWeight: '700' },
    cellTextDisabled: { color: colors.gray },
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function TimeOffScreen({ navigation }: any) {
    const [requests,   setRequests]   = useState<TimeOffRequest[]>([]);
    const [loading,    setLoading]    = useState(true);
    const [cancelling, setCancelling] = useState<number | null>(null);
    const [showModal,  setShowModal]  = useState(false);

    // Form state
    const [reqType,    setReqType]    = useState<RequestType>('vacation');
    const [startDate,  setStartDate]  = useState(today());
    const [endDate,    setEndDate]    = useState(addDays(today(), 1));
    const [reason,     setReason]     = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showStartCal, setShowStartCal] = useState(false);
    const [showEndCal,   setShowEndCal]   = useState(false);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchRequests = useCallback(async () => {
        try {
            const { data } = await TimeOffAPI.myRequests();
            setRequests(data.requests ?? []);
        } catch {
            Alert.alert('Error', 'Could not load time off requests.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    // ── Cancel ────────────────────────────────────────────────────────────────
    const handleCancel = (id: number) => {
        Alert.alert('Cancel Request', 'Are you sure you want to cancel this request?', [
            { text: 'No',  style: 'cancel' },
            {
                text: 'Yes, Cancel',
                style: 'destructive',
                onPress: async () => {
                    setCancelling(id);
                    try {
                        await TimeOffAPI.cancel(id);
                        setRequests(prev => prev.map(r =>
                            r.request_id === id ? { ...r, status: 'cancelled' } : r
                        ));
                    } catch (e: any) {
                        Alert.alert('Error', e?.response?.data?.error ?? 'Could not cancel.');
                    } finally {
                        setCancelling(null);
                    }
                },
            },
        ]);
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (endDate < startDate) {
            Alert.alert('Invalid dates', 'End date must be on or after start date.');
            return;
        }
        setSubmitting(true);
        try {
            await TimeOffAPI.create({
                start_date:   startDate,
                end_date:     endDate,
                request_type: reqType,
                reason:       reason.trim() || undefined,
            });
            Alert.alert('Submitted ✓', 'Your time off request has been sent to your manager.');
            setShowModal(false);
            setReason('');
            await fetchRequests();
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Could not submit request.');
        } finally {
            setSubmitting(false);
        }
    };

    const openModal = () => {
        setReqType('vacation');
        setStartDate(today());
        setEndDate(addDays(today(), 1));
        setReason('');
        setShowStartCal(false);
        setShowEndCal(false);
        setShowModal(true);
    };

    const pendingCount  = requests.filter(r => r.status === 'pending').length;
    const approvedCount = requests.filter(r => r.status === 'approved').length;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>

            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Time Off</Text>
                <Pressable style={styles.newBtn} onPress={openModal}>
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.newBtnText}>Request</Text>
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Stats */}
                    <View style={styles.statsRow}>
                        <View style={[styles.statCard, { borderColor: '#F59E0B30' }]}>
                            <Text style={[styles.statNum, { color: '#F59E0B' }]}>{pendingCount}</Text>
                            <Text style={styles.statLabel}>Pending</Text>
                        </View>
                        <View style={[styles.statCard, { borderColor: '#10B98130' }]}>
                            <Text style={[styles.statNum, { color: '#10B981' }]}>{approvedCount}</Text>
                            <Text style={styles.statLabel}>Approved</Text>
                        </View>
                        <View style={[styles.statCard, { borderColor: colors.primary + '30' }]}>
                            <Text style={[styles.statNum, { color: colors.primary }]}>{requests.length}</Text>
                            <Text style={styles.statLabel}>Total</Text>
                        </View>
                    </View>

                    {/* Requests list */}
                    {requests.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="calendar-outline" size={48} color={colors.inputBorder} />
                            <Text style={styles.emptyTitle}>No time off requests</Text>
                            <Text style={styles.emptySub}>Tap Request to submit your first one.</Text>
                            <Pressable style={styles.emptyBtn} onPress={openModal}>
                                <Text style={styles.emptyBtnText}>Request Time Off</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View style={styles.list}>
                            {requests.map(req => {
                                const typeCfg   = TYPE_CONFIG[req.request_type as RequestType] ?? TYPE_CONFIG.other;
                                const statusCfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
                                return (
                                    <View key={req.request_id} style={styles.card}>
                                        {/* Top row */}
                                        <View style={styles.cardTop}>
                                            <View style={[styles.typeIcon, { backgroundColor: typeCfg.color + '15' }]}>
                                                <Ionicons name={typeCfg.icon} size={20} color={typeCfg.color} />
                                            </View>
                                            <View style={styles.cardInfo}>
                                                <Text style={styles.cardType}>{typeCfg.label}</Text>
                                                <Text style={styles.cardDates}>
                                                    {fmtDate(req.start_date)}
                                                    {req.start_date !== req.end_date
                                                        ? ` → ${fmtDate(req.end_date)}`
                                                        : ''}
                                                </Text>
                                            </View>
                                            <View style={styles.cardRight}>
                                                <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                                                    <Text style={[styles.statusText, { color: statusCfg.color }]}>
                                                        {statusCfg.label}
                                                    </Text>
                                                </View>
                                                <Text style={styles.daysText}>
                                                    {req.days} {req.days === 1 ? 'day' : 'days'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Reason */}
                                        {req.reason ? (
                                            <Text style={styles.cardReason}>"{req.reason}"</Text>
                                        ) : null}

                                        {/* Manager notes */}
                                        {req.manager_notes ? (
                                            <View style={styles.managerNote}>
                                                <Ionicons name="chatbubble-outline" size={13} color={colors.gray} />
                                                <Text style={styles.managerNoteText}>{req.manager_notes}</Text>
                                            </View>
                                        ) : null}

                                        {/* Cancel button for pending */}
                                        {req.status === 'pending' && (
                                            <Pressable
                                                style={styles.cancelBtn}
                                                onPress={() => handleCancel(req.request_id)}
                                                disabled={cancelling === req.request_id}
                                            >
                                                {cancelling === req.request_id
                                                    ? <ActivityIndicator size="small" color={colors.error} />
                                                    : <Text style={styles.cancelBtnText}>Cancel Request</Text>
                                                }
                                            </Pressable>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            )}

            {/* Request Modal */}
            <Modal
                visible={showModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowModal(false)}
            >
                <Pressable style={styles.overlay} onPress={() => setShowModal(false)}>
                    <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <View style={styles.handle} />
                            <Text style={styles.sheetTitle}>Request Time Off</Text>

                            {/* Type selector */}
                            <Text style={styles.fieldLabel}>Type</Text>
                            <View style={styles.typeRow}>
                                {(Object.entries(TYPE_CONFIG) as [RequestType, typeof TYPE_CONFIG[RequestType]][]).map(([key, cfg]) => (
                                    <Pressable
                                        key={key}
                                        style={[
                                            styles.typeBtn,
                                            reqType === key && { backgroundColor: cfg.color, borderColor: cfg.color },
                                        ]}
                                        onPress={() => setReqType(key)}
                                    >
                                        <Ionicons name={cfg.icon} size={16} color={reqType === key ? '#fff' : colors.gray} />
                                        <Text style={[styles.typeBtnText, reqType === key && { color: '#fff' }]}>
                                            {cfg.label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            {/* Start date */}
                            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Start Date</Text>
                            <Pressable
                                style={styles.dateSelector}
                                onPress={() => { setShowStartCal(!showStartCal); setShowEndCal(false); }}
                            >
                                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                                <Text style={styles.dateSelectorText}>{fmtDate(startDate)}</Text>
                                <Ionicons name={showStartCal ? 'chevron-up' : 'chevron-down'} size={16} color={colors.gray} />
                            </Pressable>
                            {showStartCal && (
                                <DatePicker
                                    value={startDate}
                                    minDate={today()}
                                    onChange={v => {
                                        setStartDate(v);
                                        if (v > endDate) setEndDate(v);
                                        setShowStartCal(false);
                                    }}
                                />
                            )}

                            {/* End date */}
                            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>End Date</Text>
                            <Pressable
                                style={styles.dateSelector}
                                onPress={() => { setShowEndCal(!showEndCal); setShowStartCal(false); }}
                            >
                                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                                <Text style={styles.dateSelectorText}>{fmtDate(endDate)}</Text>
                                <Ionicons name={showEndCal ? 'chevron-up' : 'chevron-down'} size={16} color={colors.gray} />
                            </Pressable>
                            {showEndCal && (
                                <DatePicker
                                    value={endDate}
                                    minDate={startDate}
                                    onChange={v => { setEndDate(v); setShowEndCal(false); }}
                                />
                            )}

                            {/* Duration chip */}
                            <View style={styles.durationChip}>
                                <Ionicons name="moon-outline" size={14} color={colors.primary} />
                                <Text style={styles.durationChipText}>
                                    {diffDays(startDate, endDate)} {diffDays(startDate, endDate) === 1 ? 'day' : 'days'} off
                                </Text>
                            </View>

                            {/* Reason */}
                            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Reason (optional)</Text>
                            <TextInput
                                style={styles.reasonInput}
                                value={reason}
                                onChangeText={setReason}
                                placeholder="Briefly describe your reason..."
                                placeholderTextColor={colors.gray}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                                maxLength={300}
                            />
                            <Text style={styles.charCount}>{reason.length}/300</Text>

                            {/* Actions */}
                            <View style={styles.sheetActions}>
                                <Pressable style={styles.sheetCancelBtn} onPress={() => setShowModal(false)}>
                                    <Text style={styles.sheetCancelText}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                                    onPress={handleSubmit}
                                    disabled={submitting}
                                >
                                    {submitting
                                        ? <ActivityIndicator size="small" color="#fff" />
                                        : <Text style={styles.submitBtnText}>Submit Request</Text>
                                    }
                                </Pressable>
                            </View>

                            <View style={{ height: 20 }} />
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:    { flex: 1, backgroundColor: '#F8F8FC' },
    scroll:  { flex: 1 },
    content: { padding: 16 },

    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    backBtn:     { padding: 4, marginRight: 8 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
    newBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: colors.primary,
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 999,
    },
    newBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    statCard: {
        flex: 1, alignItems: 'center', backgroundColor: '#fff',
        borderRadius: 12, padding: 12, borderWidth: 1,
    },
    statNum:   { fontSize: 22, fontWeight: '800' },
    statLabel: { fontSize: 11, color: colors.gray, marginTop: 2 },

    emptyContainer: {
        alignItems: 'center', paddingVertical: 60, gap: 10,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    emptySub:   { fontSize: 13, color: colors.gray, textAlign: 'center' },
    emptyBtn: {
        marginTop: 8, paddingHorizontal: 24, paddingVertical: 12,
        backgroundColor: colors.primary, borderRadius: 999,
    },
    emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    list: { gap: 12 },
    card: {
        backgroundColor: '#fff', borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: '#EFEFEF',
        shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
    },
    cardTop:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
    typeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    cardInfo: { flex: 1 },
    cardType:  { fontSize: 14, fontWeight: '700', color: colors.text },
    cardDates: { fontSize: 12, color: colors.gray, marginTop: 2 },
    cardRight: { alignItems: 'flex-end', gap: 4 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    statusText:  { fontSize: 11, fontWeight: '700' },
    daysText:    { fontSize: 11, color: colors.gray },
    cardReason: {
        fontSize: 12, color: colors.gray, fontStyle: 'italic',
        marginTop: 6, paddingLeft: 50,
    },
    managerNote: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 6,
        marginTop: 8, padding: 8, backgroundColor: '#F3F4F6', borderRadius: 8,
    },
    managerNoteText: { flex: 1, fontSize: 12, color: colors.gray },
    cancelBtn: {
        marginTop: 10, paddingVertical: 8, alignItems: 'center',
        borderRadius: 8, borderWidth: 1, borderColor: colors.error + '50',
    },
    cancelBtnText: { fontSize: 13, color: colors.error, fontWeight: '600' },

    // Modal
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, maxHeight: '92%',
    },
    handle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 20,
    },
    sheetTitle:  { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 20 },
    fieldLabel:  { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },

    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 999, borderWidth: 1.5, borderColor: colors.inputBorder,
        backgroundColor: '#FAFAFA',
    },
    typeBtnText: { fontSize: 12, fontWeight: '600', color: colors.gray },

    dateSelector: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        borderWidth: 1.5, borderColor: colors.inputBorder,
        borderRadius: 12, padding: 12, backgroundColor: '#FAFAFA',
    },
    dateSelectorText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },

    durationChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: 10, paddingVertical: 7, paddingHorizontal: 12,
        backgroundColor: colors.primary + '12', borderRadius: 999,
        borderWidth: 1, borderColor: colors.primary + '25',
        alignSelf: 'flex-start',
    },
    durationChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },

    reasonInput: {
        borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 12,
        padding: 12, fontSize: 14, color: colors.text,
        minHeight: 80, backgroundColor: '#FAFAFA',
    },
    charCount: { fontSize: 11, color: colors.gray, textAlign: 'right', marginTop: 4 },

    sheetActions:    { flexDirection: 'row', gap: 12, marginTop: 20 },
    sheetCancelBtn: {
        flex: 1, alignItems: 'center', paddingVertical: 13,
        borderRadius: 999, borderWidth: 1.5, borderColor: colors.inputBorder,
    },
    sheetCancelText: { fontSize: 14, fontWeight: '600', color: colors.gray },
    submitBtn: {
        flex: 1, alignItems: 'center', paddingVertical: 13,
        borderRadius: 999, backgroundColor: colors.primary,
    },
    submitBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});