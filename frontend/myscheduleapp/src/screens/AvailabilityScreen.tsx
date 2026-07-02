// src/screens/AvailabilityScreen.tsx
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    Pressable, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { Ionicons }        from '@expo/vector-icons';
import { colors }          from '../theme/colors';
import { AvailabilityAPI } from '../api/api';
import { AuthContext }     from '../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type AvailEntry = {
    availability_id: number;
    emp_id:          number;
    day_of_week:     string;
    start_time:      string;  // "HH:MM"
    end_time:        string;
};

type DayMode = 'anytime' | 'hours' | 'off' | 'unset';

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = [
    { key: 'mon', label: 'Monday',    short: 'Mon' },
    { key: 'tue', label: 'Tuesday',   short: 'Tue' },
    { key: 'wed', label: 'Wednesday', short: 'Wed' },
    { key: 'thu', label: 'Thursday',  short: 'Thu' },
    { key: 'fri', label: 'Friday',    short: 'Fri' },
    { key: 'sat', label: 'Saturday',  short: 'Sat' },
    { key: 'sun', label: 'Sunday',    short: 'Sun' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => {
    const label = new Date(2000, 0, 1, i, 0)
        .toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { value: `${String(i).padStart(2, '0')}:00`, label };
});

const ANYTIME_START = '00:00';
const ANYTIME_END   = '23:59';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(hhmm: string): string {
    const [h] = hhmm.split(':').map(Number);
    const ampm = h < 12 ? 'AM' : 'PM';
    const hour = h % 12 === 0 ? 12 : h % 12;
    const mins = hhmm.split(':')[1];
    return `${hour}:${mins} ${ampm}`;
}

function detectMode(entries: AvailEntry[]): DayMode {
    if (entries.length === 0) return 'unset';
    if (entries.length === 1 && entries[0].start_time === ANYTIME_START && entries[0].end_time === ANYTIME_END)
        return 'anytime';
    return 'hours';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AvailabilityScreen({ navigation }: any) {
    const { user: authUser } = useContext(AuthContext);

    const [avails,     setAvails]     = useState<AvailEntry[]>([]);
    const [empId,      setEmpId]      = useState<number | null>(null);
    const [loading,    setLoading]    = useState(true);
    const [busy,       setBusy]       = useState<string | null>(null); // dayKey being processed

    // Add-slot modal
    const [modalDay,   setModalDay]   = useState('mon');
    const [showModal,  setShowModal]  = useState(false);
    const [startTime,  setStartTime]  = useState('09:00');
    const [endTime,    setEndTime]    = useState('17:00');
    const [saving,     setSaving]     = useState(false);
    const [showStart,  setShowStart]  = useState(false);
    const [showEnd,    setShowEnd]    = useState(false);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchAvails = useCallback(async () => {
        try {
            const { data } = await AvailabilityAPI.getMine();
            setAvails(data.availabilities ?? []);
            if (data.emp_id) setEmpId(data.emp_id);
        } catch {
            Alert.alert('Error', 'Could not load your availability.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAvails(); }, [fetchAvails]);

    // ── Delete all slots for a day ────────────────────────────────────────────
    const clearDay = async (dayKey: string) => {
        const toDelete = avails.filter(a => a.day_of_week === dayKey);
        await Promise.all(toDelete.map(a => AvailabilityAPI.delete(a.availability_id)));
        setAvails(prev => prev.filter(a => a.day_of_week !== dayKey));
    };

    // ── Handle Anytime ────────────────────────────────────────────────────────
    const handleAnytime = async (dayKey: string) => {
        if (!empId) return;
        const entries  = avails.filter(a => a.day_of_week === dayKey);
        const mode     = detectMode(entries);
        if (mode === 'anytime') return; // already set

        setBusy(dayKey);
        try {
            await clearDay(dayKey);
            const { data } = await AvailabilityAPI.create({
                emp_id:      empId,
                day_of_week: dayKey,
                start_time:  ANYTIME_START,
                end_time:    ANYTIME_END,
            });
            const created = data.created?.[0] ?? data;
            setAvails(prev => [...prev, created]);
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.errors?.[0]?.error ?? 'Could not save.');
        } finally {
            setBusy(null);
        }
    };

    // ── Handle Off ────────────────────────────────────────────────────────────
    const handleOff = async (dayKey: string) => {
        const entries = avails.filter(a => a.day_of_week === dayKey);
        if (entries.length === 0) return; // already off
        setBusy(dayKey);
        try {
            await clearDay(dayKey);
        } catch {
            Alert.alert('Error', 'Could not update.');
        } finally {
            setBusy(null);
        }
    };

    // ── Open add-slot modal ───────────────────────────────────────────────────
    const openAddModal = (dayKey: string) => {
        setModalDay(dayKey);
        setStartTime('09:00');
        setEndTime('17:00');
        setShowStart(false);
        setShowEnd(false);
        setShowModal(true);
    };

    // ── Save new slot ─────────────────────────────────────────────────────────
    const handleSaveSlot = async () => {
        if (!empId) return;
        if (startTime >= endTime) {
            Alert.alert('Invalid', 'End time must be after start time.');
            return;
        }
        setSaving(true);
        try {
            const { data } = await AvailabilityAPI.create({
                emp_id:      empId,
                day_of_week: modalDay,
                start_time:  startTime,
                end_time:    endTime,
            });
            const created = data.created?.[0] ?? data;
            if (created) setAvails(prev => [...prev, created]);
            setShowModal(false);
            await fetchAvails();
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.errors?.[0]?.error ?? 'Could not save. Check for overlapping times.');
        } finally {
            setSaving(false);
        }
    };

    // ── Delete a single slot ──────────────────────────────────────────────────
    const handleDeleteSlot = (id: number) => {
        Alert.alert('Remove Time Slot', 'Remove this time slot?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await AvailabilityAPI.delete(id);
                        setAvails(prev => prev.filter(a => a.availability_id !== id));
                    } catch {
                        Alert.alert('Error', 'Could not remove.');
                    }
                },
            },
        ]);
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>

            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>My Availability</Text>
            </View>

            {/* Info */}
            <View style={styles.banner}>
                <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                <Text style={styles.bannerText}>
                    Let your manager know when you're available. Changes take effect immediately.
                </Text>
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
                    {DAYS.map(day => {
                        const entries  = avails.filter(a => a.day_of_week === day.key);
                        const mode     = detectMode(entries);
                        const isBusy   = busy === day.key;

                        return (
                            <View key={day.key} style={styles.dayCard}>
                                {/* Day name */}
                                <Text style={styles.dayLabel}>{day.label}</Text>

                                {/* Three mode buttons */}
                                <View style={styles.modeRow}>
                                    {/* Anytime */}
                                    <Pressable
                                        style={[
                                            styles.modeBtn,
                                            mode === 'anytime' && styles.modeBtnAnytime,
                                        ]}
                                        onPress={() => handleAnytime(day.key)}
                                        disabled={isBusy}
                                    >
                                        <Ionicons
                                            name="sunny-outline"
                                            size={14}
                                            color={mode === 'anytime' ? '#fff' : colors.gray}
                                        />
                                        <Text style={[
                                            styles.modeBtnText,
                                            mode === 'anytime' && styles.modeBtnTextActive,
                                        ]}>
                                            Anytime
                                        </Text>
                                    </Pressable>

                                    {/* Set hours */}
                                    <Pressable
                                        style={[
                                            styles.modeBtn,
                                            mode === 'hours' && styles.modeBtnHours,
                                        ]}
                                        onPress={() => openAddModal(day.key)}
                                        disabled={isBusy}
                                    >
                                        <Ionicons
                                            name="time-outline"
                                            size={14}
                                            color={mode === 'hours' ? '#fff' : colors.gray}
                                        />
                                        <Text style={[
                                            styles.modeBtnText,
                                            mode === 'hours' && styles.modeBtnTextActive,
                                        ]}>
                                            Set Hours
                                        </Text>
                                    </Pressable>

                                    {/* Not available */}
                                    <Pressable
                                        style={[
                                            styles.modeBtn,
                                            (mode === 'off' || mode === 'unset') && styles.modeBtnOff,
                                        ]}
                                        onPress={() => handleOff(day.key)}
                                        disabled={isBusy}
                                    >
                                        <Ionicons
                                            name="close-circle-outline"
                                            size={14}
                                            color={(mode === 'off' || mode === 'unset') ? '#fff' : colors.gray}
                                        />
                                        <Text style={[
                                            styles.modeBtnText,
                                            (mode === 'off' || mode === 'unset') && styles.modeBtnTextActive,
                                        ]}>
                                            Not Available
                                        </Text>
                                    </Pressable>
                                </View>

                                {/* Busy spinner */}
                                {isBusy && (
                                    <ActivityIndicator
                                        size="small"
                                        color={colors.primary}
                                        style={{ marginTop: 8 }}
                                    />
                                )}

                                {/* Anytime label */}
                                {mode === 'anytime' && !isBusy && (
                                    <View style={styles.anytimeChip}>
                                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                                        <Text style={styles.anytimeChipText}>All day — anytime</Text>
                                    </View>
                                )}

                                {/* Time slots */}
                                {mode === 'hours' && !isBusy && (
                                    <View style={styles.slotsSection}>
                                        {entries.map(e => (
                                            <View key={e.availability_id} style={styles.slot}>
                                                <Ionicons name="time-outline" size={14} color={colors.primary} />
                                                <Text style={styles.slotText}>
                                                    {fmt(e.start_time)} – {fmt(e.end_time)}
                                                </Text>
                                                <Pressable
                                                    onPress={() => handleDeleteSlot(e.availability_id)}
                                                    style={styles.slotDelete}
                                                >
                                                    <Ionicons name="trash-outline" size={15} color={colors.error} />
                                                </Pressable>
                                            </View>
                                        ))}

                                        {/* Add another slot */}
                                        <Pressable
                                            style={styles.addSlotBtn}
                                            onPress={() => openAddModal(day.key)}
                                        >
                                            <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                                            <Text style={styles.addSlotBtnText}>Add another time slot</Text>
                                        </Pressable>
                                    </View>
                                )}

                                {/* Off label */}
                                {(mode === 'off' || mode === 'unset') && !isBusy && (
                                    <View style={styles.offChip}>
                                        <Ionicons name="moon-outline" size={13} color={colors.gray} />
                                        <Text style={styles.offChipText}>
                                            {mode === 'unset' ? 'Not set' : 'Not available'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        );
                    })}

                    <View style={{ height: 40 }} />
                </ScrollView>
            )}

            {/* Add time slot modal */}
            <Modal
                visible={showModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowModal(false)}
            >
                <Pressable style={styles.overlay} onPress={() => setShowModal(false)}>
                    <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
                        <View style={styles.handle} />

                        <Text style={styles.sheetTitle}>
                            Add Time Slot — {DAYS.find(d => d.key === modalDay)?.label}
                        </Text>
                        <Text style={styles.sheetSub}>
                            {avails.filter(a => a.day_of_week === modalDay).length > 0
                                ? 'Adding another split for this day.'
                                : 'Set the hours you can work.'}
                        </Text>

                        {/* Start time picker */}
                        <Text style={styles.fieldLabel}>From</Text>
                        <Pressable
                            style={styles.timePill}
                            onPress={() => { setShowStart(!showStart); setShowEnd(false); }}
                        >
                            <Ionicons name="time-outline" size={18} color={colors.primary} />
                            <Text style={styles.timePillText}>{fmt(startTime)}</Text>
                            <Ionicons name={showStart ? 'chevron-up' : 'chevron-down'} size={16} color={colors.gray} />
                        </Pressable>
                        {showStart && (
                            <ScrollView style={styles.picker} nestedScrollEnabled>
                                {HOURS.map(h => (
                                    <Pressable
                                        key={h.value}
                                        style={[styles.pickerRow, startTime === h.value && styles.pickerRowActive]}
                                        onPress={() => { setStartTime(h.value); setShowStart(false); }}
                                    >
                                        <Text style={[styles.pickerText, startTime === h.value && styles.pickerTextActive]}>
                                            {h.label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        )}

                        {/* End time picker */}
                        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>To</Text>
                        <Pressable
                            style={styles.timePill}
                            onPress={() => { setShowEnd(!showEnd); setShowStart(false); }}
                        >
                            <Ionicons name="time-outline" size={18} color={colors.primary} />
                            <Text style={styles.timePillText}>{fmt(endTime)}</Text>
                            <Ionicons name={showEnd ? 'chevron-up' : 'chevron-down'} size={16} color={colors.gray} />
                        </Pressable>
                        {showEnd && (
                            <ScrollView style={styles.picker} nestedScrollEnabled>
                                {HOURS.map(h => (
                                    <Pressable
                                        key={h.value}
                                        style={[styles.pickerRow, endTime === h.value && styles.pickerRowActive]}
                                        onPress={() => { setEndTime(h.value); setShowEnd(false); }}
                                    >
                                        <Text style={[styles.pickerText, endTime === h.value && styles.pickerTextActive]}>
                                            {h.label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        )}

                        {/* Actions */}
                        <View style={styles.sheetActions}>
                            <Pressable style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                                onPress={handleSaveSlot}
                                disabled={saving}
                            >
                                {saving
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <Text style={styles.saveBtnText}>Add Slot</Text>
                                }
                            </Pressable>
                        </View>
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

    banner: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        margin: 16, marginBottom: 8, padding: 12,
        borderRadius: 10, backgroundColor: colors.subtleAccent,
        borderWidth: 1, borderColor: colors.primary + '20',
    },
    bannerText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 18 },

    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // Day card
    dayCard: {
        backgroundColor: '#fff', borderRadius: 14,
        padding: 14, marginBottom: 10,
        borderWidth: 1, borderColor: '#EFEFEF',
        shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
    },
    dayLabel: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 },

    // Mode buttons
    modeRow: { flexDirection: 'row', gap: 8 },
    modeBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 4, paddingVertical: 8, borderRadius: 10,
        borderWidth: 1.5, borderColor: colors.inputBorder,
        backgroundColor: '#FAFAFA',
    },
    modeBtnAnytime:   { backgroundColor: colors.success,  borderColor: colors.success  },
    modeBtnHours:     { backgroundColor: colors.primary,  borderColor: colors.primary  },
    modeBtnOff:       { backgroundColor: colors.gray,     borderColor: colors.gray     },
    modeBtnText:      { fontSize: 11, fontWeight: '600', color: colors.gray },
    modeBtnTextActive:{ color: '#fff' },

    // Anytime chip
    anytimeChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: 10, paddingVertical: 8, paddingHorizontal: 12,
        borderRadius: 8, backgroundColor: colors.success + '12',
        borderWidth: 1, borderColor: colors.success + '30',
        alignSelf: 'flex-start',
    },
    anytimeChipText: { fontSize: 12, fontWeight: '600', color: colors.success },

    // Off chip
    offChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: 10, paddingVertical: 6, paddingHorizontal: 10,
        borderRadius: 8, backgroundColor: '#F3F4F6',
        alignSelf: 'flex-start',
    },
    offChipText: { fontSize: 12, color: colors.gray, fontStyle: 'italic' },

    // Time slots
    slotsSection: { marginTop: 12, gap: 8 },
    slot: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: colors.primary + '08', borderRadius: 10,
        paddingVertical: 10, paddingHorizontal: 12,
        borderWidth: 1, borderColor: colors.primary + '20',
    },
    slotText:   { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
    slotDelete: { padding: 4 },

    addSlotBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 10, paddingHorizontal: 12,
        borderRadius: 10, borderWidth: 1.5,
        borderColor: colors.primary + '40',
        borderStyle: 'dashed',
        justifyContent: 'center',
    },
    addSlotBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },

    // Modal
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, paddingBottom: 44,
    },
    handle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 20,
    },
    sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4 },
    sheetSub:   { fontSize: 13, color: colors.gray, marginBottom: 20 },

    fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
    timePill: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        borderWidth: 1.5, borderColor: colors.inputBorder,
        borderRadius: 12, padding: 12, backgroundColor: '#FAFAFA',
    },
    timePillText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },

    picker: {
        maxHeight: 180, borderWidth: 1,
        borderColor: colors.inputBorder, borderRadius: 12,
        marginTop: 4,
    },
    pickerRow: {
        paddingVertical: 10, paddingHorizontal: 16,
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    pickerRowActive: { backgroundColor: colors.primary + '15' },
    pickerText:      { fontSize: 14, color: colors.text },
    pickerTextActive:{ color: colors.primary, fontWeight: '700' },

    sheetActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
    cancelBtn: {
        flex: 1, alignItems: 'center', paddingVertical: 13,
        borderRadius: 999, borderWidth: 1.5, borderColor: colors.inputBorder,
    },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.gray },
    saveBtn: {
        flex: 1, alignItems: 'center', paddingVertical: 13,
        borderRadius: 999, backgroundColor: colors.primary,
    },
    saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});