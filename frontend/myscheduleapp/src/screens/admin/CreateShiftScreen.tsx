// src/screens/admin/CreateShiftScreen.tsx
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
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ShiftsAPI, AdminAPI } from '../../api/api';
import { useQuery } from '@apollo/client/react';
import { LOCATION_ROLES_QUERY, GET_TEAM_MEMBERS_QUERY } from '../../graphql/operations';

// ── Types ─────────────────────────────────────────────────────────────────────

type Role   = { id: number; name: string; isSystem: boolean };
type Member = { id: number; username: string; display_name?: string | null };

type RolesData   = { locationRoles: Role[] };
type MembersData = { teamMembers: Member[] };

// ── Time helpers ──────────────────────────────────────────────────────────────

function buildISO(dateStr: string, timeStr: string): string {
    // dateStr: "YYYY-MM-DD", timeStr: "HH:MM"
    return `${dateStr}T${timeStr}:00`;
}

function validateTime(t: string): boolean {
    return /^\d{2}:\d{2}$/.test(t) && (() => {
        const [h, m] = t.split(':').map(Number);
        return h >= 0 && h <= 23 && m >= 0 && m <= 59;
    })();
}

function formatDateDisplay(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-CA', {
        weekday: 'long',
        month:   'long',
        day:     'numeric',
        year:    'numeric',
    });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreateShiftScreen({ route, navigation }: any) {
    const { locationId, date: initialDate } = route.params ?? {};

    const [date,          setDate]          = useState<string>(initialDate ?? '');
    const [startTime,     setStartTime]     = useState('09:00');
    const [endTime,       setEndTime]       = useState('17:00');
    const [breakMinutes,  setBreakMinutes]  = useState('30');
    const [notes,         setNotes]         = useState('');
    const [selectedRoleId,   setSelectedRoleId]   = useState<number | null>(null);
    const [selectedUserIds,  setSelectedUserIds]   = useState<number[]>([]);
    const [submitting,    setSubmitting]    = useState(false);
    const [showRoles,     setShowRoles]     = useState(false);
    const [showStaff,     setShowStaff]     = useState(false);

    // ── Roles ─────────────────────────────────────────────────────────────────
    const { data: rolesData, loading: loadingRoles } = useQuery<RolesData>(
        LOCATION_ROLES_QUERY,
        {
            variables:   { locationId },
            skip:        !locationId,
            fetchPolicy: 'cache-and-network',
        }
    );
    const roles = rolesData?.locationRoles ?? [];

    // ── Team members ──────────────────────────────────────────────────────────
    const { data: membersData, loading: loadingMembers } = useQuery<MembersData>(
        GET_TEAM_MEMBERS_QUERY,
        {
            variables:   { locationId },
            skip:        !locationId,
            fetchPolicy: 'cache-and-network',
        }
    );
    const members = membersData?.teamMembers ?? [];

    const selectedRole = roles.find(r => r.id === selectedRoleId);

    const toggleMember = (id: number) => {
        setSelectedUserIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleCreate = useCallback(async () => {
        if (!locationId) {
            Alert.alert('Error', 'No location selected.');
            return;
        }
        if (!date) {
            Alert.alert('Error', 'Please select a date.');
            return;
        }
        if (!validateTime(startTime)) {
            Alert.alert('Error', 'Start time must be in HH:MM format (e.g. 09:00).');
            return;
        }
        if (!validateTime(endTime)) {
            Alert.alert('Error', 'End time must be in HH:MM format (e.g. 17:00).');
            return;
        }
        if (startTime >= endTime) {
            Alert.alert('Error', 'End time must be after start time.');
            return;
        }

        setSubmitting(true);
        try {
            // 1) Create the shift
            const { data } = await ShiftsAPI.create({
                location_id:   locationId,
                start_time:    buildISO(date, startTime),
                end_time:      buildISO(date, endTime),
                role_id:       selectedRoleId ?? undefined,
                break_minutes: parseInt(breakMinutes || '0', 10),
                notes:         notes.trim() || undefined,
            });

            const shiftId = data?.shift?.shift_id;

            // 2) Assign selected staff
            if (shiftId && selectedUserIds.length > 0) {
                await Promise.all(
                    selectedUserIds.map(uid =>
                        ShiftsAPI.assign(shiftId, uid).catch(() => {})
                    )
                );
            }

            Alert.alert(
                'Shift Created ✓',
                `Draft shift created for ${formatDateDisplay(date)}.${
                    selectedUserIds.length > 0
                        ? ` ${selectedUserIds.length} staff assigned.`
                        : ''
                }`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (e: any) {
            const msg = e?.response?.data?.error ?? 'Failed to create shift.';
            Alert.alert('Error', msg);
        } finally {
            setSubmitting(false);
        }
    }, [
        locationId, date, startTime, endTime,
        breakMinutes, notes, selectedRoleId, selectedUserIds,
    ]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>

            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn}>
                    <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Create Shift</Text>
                <Pressable
                    onPress={handleCreate}
                    disabled={submitting}
                    style={[styles.saveBtn, submitting && { opacity: 0.5 }]}
                >
                    {submitting
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.saveBtnText}>Save</Text>
                    }
                </Pressable>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
            >
                {/* Date */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Date</Text>
                    <View style={styles.dateDisplay}>
                        <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                        <Text style={styles.dateText}>
                            {date ? formatDateDisplay(date) : 'No date selected'}
                        </Text>
                    </View>
                    <Text style={styles.hint}>
                        Date is set from the calendar. Tap a day's + button to change.
                    </Text>
                </View>

                {/* Time */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Time</Text>
                    <View style={styles.timeRow}>
                        <View style={styles.timeField}>
                            <Text style={styles.fieldLabel}>Start time</Text>
                            <TextInput
                                style={styles.timeInput}
                                value={startTime}
                                onChangeText={setStartTime}
                                placeholder="09:00"
                                placeholderTextColor={colors.gray}
                                keyboardType="numbers-and-punctuation"
                                maxLength={5}
                            />
                        </View>
                        <View style={styles.timeSeparator}>
                            <Text style={styles.timeSeparatorText}>→</Text>
                        </View>
                        <View style={styles.timeField}>
                            <Text style={styles.fieldLabel}>End time</Text>
                            <TextInput
                                style={styles.timeInput}
                                value={endTime}
                                onChangeText={setEndTime}
                                placeholder="17:00"
                                placeholderTextColor={colors.gray}
                                keyboardType="numbers-and-punctuation"
                                maxLength={5}
                            />
                        </View>
                    </View>

                    {/* Quick time presets */}
                    <Text style={[styles.fieldLabel, { marginTop: 12, marginBottom: 6 }]}>
                        Quick presets
                    </Text>
                    <View style={styles.presetRow}>
                        {[
                            { label: 'Morning',   start: '07:00', end: '15:00' },
                            { label: 'Afternoon', start: '12:00', end: '20:00' },
                            { label: 'Evening',   start: '15:00', end: '23:00' },
                            { label: 'Full day',  start: '09:00', end: '17:00' },
                        ].map(p => (
                            <Pressable
                                key={p.label}
                                style={[
                                    styles.preset,
                                    startTime === p.start && endTime === p.end
                                        && styles.presetActive,
                                ]}
                                onPress={() => {
                                    setStartTime(p.start);
                                    setEndTime(p.end);
                                }}
                            >
                                <Text style={[
                                    styles.presetText,
                                    startTime === p.start && endTime === p.end
                                        && styles.presetTextActive,
                                ]}>
                                    {p.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Break */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Break</Text>
                    <View style={styles.breakRow}>
                        {['0', '15', '30', '45', '60'].map(mins => (
                            <Pressable
                                key={mins}
                                style={[
                                    styles.breakChip,
                                    breakMinutes === mins && styles.breakChipActive,
                                ]}
                                onPress={() => setBreakMinutes(mins)}
                            >
                                <Text style={[
                                    styles.breakChipText,
                                    breakMinutes === mins && styles.breakChipTextActive,
                                ]}>
                                    {mins === '0' ? 'None' : `${mins}m`}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Role */}
                <View style={styles.card}>
                    <Pressable
                        style={styles.sectionHeader}
                        onPress={() => setShowRoles(p => !p)}
                    >
                        <Text style={styles.cardTitle}>
                            Role
                            {selectedRole ? ` — ${selectedRole.name}` : ' (optional)'}
                        </Text>
                        <Ionicons
                            name={showRoles ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={colors.gray}
                        />
                    </Pressable>

                    {showRoles && (
                        <View style={styles.optionList}>
                            <Pressable
                                style={[styles.option, !selectedRoleId && styles.optionActive]}
                                onPress={() => setSelectedRoleId(null)}
                            >
                                <Text style={[
                                    styles.optionText,
                                    !selectedRoleId && styles.optionTextActive,
                                ]}>
                                    Any role
                                </Text>
                                {!selectedRoleId && (
                                    <Ionicons name="checkmark" size={16} color={colors.primary} />
                                )}
                            </Pressable>
                            {loadingRoles ? (
                                <ActivityIndicator style={{ margin: 12 }} color={colors.primary} />
                            ) : (
                                roles.map(role => (
                                    <Pressable
                                        key={role.id}
                                        style={[
                                            styles.option,
                                            selectedRoleId === role.id && styles.optionActive,
                                        ]}
                                        onPress={() => {
                                            setSelectedRoleId(role.id);
                                            setShowRoles(false);
                                        }}
                                    >
                                        <Text style={[
                                            styles.optionText,
                                            selectedRoleId === role.id && styles.optionTextActive,
                                        ]}>
                                            {role.name}
                                        </Text>
                                        {selectedRoleId === role.id && (
                                            <Ionicons name="checkmark" size={16} color={colors.primary} />
                                        )}
                                    </Pressable>
                                ))
                            )}
                        </View>
                    )}
                </View>

                {/* Assign staff */}
                <View style={styles.card}>
                    <Pressable
                        style={styles.sectionHeader}
                        onPress={() => setShowStaff(p => !p)}
                    >
                        <Text style={styles.cardTitle}>
                            Assign Staff
                            {selectedUserIds.length > 0
                                ? ` (${selectedUserIds.length} selected)`
                                : ' (optional)'}
                        </Text>
                        <Ionicons
                            name={showStaff ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={colors.gray}
                        />
                    </Pressable>

                    {showStaff && (
                        <View style={styles.optionList}>
                            {loadingMembers ? (
                                <ActivityIndicator style={{ margin: 12 }} color={colors.primary} />
                            ) : members.length === 0 ? (
                                <Text style={styles.emptyText}>No staff at this location yet.</Text>
                            ) : (
                                members.map(member => {
                                    const selected = selectedUserIds.includes(member.id);
                                    const name = member.display_name || member.username;
                                    return (
                                        <Pressable
                                            key={member.id}
                                            style={[styles.option, selected && styles.optionActive]}
                                            onPress={() => toggleMember(member.id)}
                                        >
                                            <View style={styles.memberInfo}>
                                                <View style={styles.memberAvatar}>
                                                    <Text style={styles.memberAvatarText}>
                                                        {name[0].toUpperCase()}
                                                    </Text>
                                                </View>
                                                <Text style={[
                                                    styles.optionText,
                                                    selected && styles.optionTextActive,
                                                ]}>
                                                    {name}
                                                </Text>
                                            </View>
                                            {selected && (
                                                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                                            )}
                                        </Pressable>
                                    );
                                })
                            )}
                        </View>
                    )}
                </View>

                {/* Notes */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Notes (optional)</Text>
                    <TextInput
                        style={styles.notesInput}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="e.g. Cover the bar, training shift, etc."
                        placeholderTextColor={colors.gray}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                    />
                </View>

                {/* Summary */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Summary</Text>
                    <Text style={styles.summaryLine}>
                        📅  {date ? formatDateDisplay(date) : '—'}
                    </Text>
                    <Text style={styles.summaryLine}>
                        ⏰  {startTime} → {endTime}
                        {breakMinutes !== '0' ? `  (${breakMinutes}m break)` : ''}
                    </Text>
                    {selectedRole && (
                        <Text style={styles.summaryLine}>💼  {selectedRole.name}</Text>
                    )}
                    {selectedUserIds.length > 0 && (
                        <Text style={styles.summaryLine}>
                            👥  {selectedUserIds.length} staff assigned
                        </Text>
                    )}
                    <Text style={[styles.summaryLine, { color: colors.warning, marginTop: 4 }]}>
                        📝  Saved as DRAFT — publish when ready
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:   { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },

    header: {
        flexDirection:     'row',
        alignItems:        'center',
        paddingHorizontal: 16,
        paddingVertical:   12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    closeBtn:    { padding: 4, marginRight: 8 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
    saveBtn: {
        paddingHorizontal: 18,
        paddingVertical:    8,
        borderRadius:      999,
        backgroundColor:   colors.primary,
        minWidth:          64,
        alignItems:        'center',
    },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    card: {
        backgroundColor: '#fff',
        borderRadius:    14,
        padding:         16,
        marginBottom:    12,
        borderWidth:     1,
        borderColor:     '#F0F0F0',
        shadowColor:     '#000',
        shadowOpacity:   0.03,
        shadowRadius:    4,
        elevation:       1,
    },
    cardTitle:     { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    hint:          { fontSize: 11, color: colors.gray, marginTop: 6 },

    dateDisplay: {
        flexDirection:   'row',
        alignItems:      'center',
        gap:             8,
        backgroundColor: colors.subtleAccent,
        padding:         12,
        borderRadius:    10,
    },
    dateText: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },

    timeRow: {
        flexDirection: 'row',
        alignItems:    'flex-end',
        gap:           8,
    },
    timeField: { flex: 1 },
    fieldLabel: { fontSize: 12, color: colors.gray, marginBottom: 6, fontWeight: '600' },
    timeInput: {
        borderWidth:      1,
        borderColor:      colors.inputBorder,
        borderRadius:     10,
        paddingHorizontal: 12,
        paddingVertical:   10,
        fontSize:         16,
        fontWeight:       '700',
        color:            colors.text,
        textAlign:        'center',
        backgroundColor:  '#FAFAFA',
    },
    timeSeparator:     { paddingBottom: 10 },
    timeSeparatorText: { fontSize: 18, color: colors.gray, fontWeight: '300' },

    presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    preset: {
        paddingHorizontal: 12,
        paddingVertical:    6,
        borderRadius:      999,
        borderWidth:       1,
        borderColor:       colors.inputBorder,
        backgroundColor:   '#FAFAFA',
    },
    presetActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
    presetText:       { fontSize: 12, color: colors.text, fontWeight: '600' },
    presetTextActive: { color: '#fff' },

    breakRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    breakChip: {
        paddingHorizontal: 16,
        paddingVertical:    8,
        borderRadius:      999,
        borderWidth:       1,
        borderColor:       colors.inputBorder,
        backgroundColor:   '#FAFAFA',
    },
    breakChipActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
    breakChipText:       { fontSize: 13, color: colors.text, fontWeight: '600' },
    breakChipTextActive: { color: '#fff' },

    optionList: { marginTop: 12, gap: 2 },
    option: {
        flexDirection:     'row',
        alignItems:        'center',
        justifyContent:    'space-between',
        paddingHorizontal: 12,
        paddingVertical:    10,
        borderRadius:       8,
        backgroundColor:   '#FAFAFA',
    },
    optionActive:     { backgroundColor: colors.subtleAccent },
    optionText:       { fontSize: 14, color: colors.text },
    optionTextActive: { color: colors.primary, fontWeight: '700' },
    emptyText:        { fontSize: 13, color: colors.gray, padding: 12, textAlign: 'center' },

    memberInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    memberAvatar: {
        width:          32,
        height:         32,
        borderRadius:   16,
        backgroundColor: colors.primary + '20',
        alignItems:     'center',
        justifyContent: 'center',
    },
    memberAvatarText: { fontSize: 14, fontWeight: '700', color: colors.primary },

    notesInput: {
        borderWidth:      1,
        borderColor:      colors.inputBorder,
        borderRadius:     10,
        paddingHorizontal: 12,
        paddingVertical:   10,
        fontSize:         14,
        color:            colors.text,
        backgroundColor:  '#FAFAFA',
        minHeight:        80,
    },

    summaryCard: {
        backgroundColor: colors.subtleCard,
        borderRadius:    14,
        padding:         16,
        marginBottom:    12,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        gap:             6,
    },
    summaryTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 4 },
    summaryLine:  { fontSize: 13, color: colors.text },
});