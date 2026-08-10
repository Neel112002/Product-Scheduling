// src/screens/admin/ShiftDetailScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ShiftsAPI, AdminAPI } from '../../api/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type ShiftDetail = {
    shift_id:      number;
    location_id:   number;
    role?:         string | null;
    start_time:    string;
    end_time:      string;
    break_minutes: number;
    notes?:        string | null;
    status:        'draft' | 'published' | 'cancelled';
    created_by_ai: boolean;
    published_at?: string | null;
    assignments:   { user_id: number; assigned_at: string }[];
};

type StaffMember = {
    user_id:      number;
    username:     string;
    display_name?: string | null;
    email:        string;
    role?:        string | null;
    emp_id:       number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-CA', {
        hour:    '2-digit',
        minute:  '2-digit',
        hour12:  true,
    });
}

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-CA', {
        weekday: 'long',
        month:   'long',
        day:     'numeric',
        year:    'numeric',
    });
}

function calcHours(start: string, end: string, breakMins: number): string {
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
    const net  = Math.max(diff - breakMins, 0);
    const h    = Math.floor(net / 60);
    const m    = net % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ShiftDetailScreen({ route, navigation }: any) {
    const { shiftId, locationId } = route.params ?? {};

    const [shift,          setShift]          = useState<ShiftDetail | null>(null);
    const [allStaff,       setAllStaff]       = useState<StaffMember[]>([]);
    const [loading,        setLoading]        = useState(true);
    const [cancelling,     setCancelling]     = useState(false);
    const [showAddStaff,   setShowAddStaff]   = useState(false);
    const [assigning,      setAssigning]      = useState<number | null>(null);
    const [unassigning,    setUnassigning]    = useState<number | null>(null);

    // ── Fetch shift ───────────────────────────────────────────────────────────
    const fetchShift = useCallback(async () => {
        try {
            const { data } = await ShiftsAPI.get(shiftId);
            setShift(data?.shift ?? null);
        } catch {
            Alert.alert('Error', 'Could not load shift details.');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    }, [shiftId]);

    // ── Fetch all staff at location ───────────────────────────────────────────
    const fetchStaff = useCallback(async () => {
        try {
            const { data } = await AdminAPI.listStaff(locationId);
            setAllStaff(data?.staff ?? []);
        } catch {
            setAllStaff([]);
        }
    }, [locationId]);

    useEffect(() => {
        fetchShift();
        fetchStaff();
    }, [fetchShift, fetchStaff]);

    // ── Assign staff ──────────────────────────────────────────────────────────
    const handleAssign = async (userId: number) => {
        if (!shift) return;
        setAssigning(userId);
        try {
            await ShiftsAPI.assign(shift.shift_id, userId);
            await fetchShift();
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Could not assign staff.');
        } finally {
            setAssigning(null);
        }
    };

    // ── Unassign staff ────────────────────────────────────────────────────────
    const handleUnassign = async (userId: number) => {
        if (!shift) return;
        Alert.alert(
            'Remove Staff',
            'Remove this person from the shift?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        setUnassigning(userId);
                        try {
                            await ShiftsAPI.unassign(shift.shift_id, userId);
                            await fetchShift();
                        } catch {
                            Alert.alert('Error', 'Could not remove staff.');
                        } finally {
                            setUnassigning(null);
                        }
                    },
                },
            ]
        );
    };

    // ── Cancel shift ──────────────────────────────────────────────────────────
    const handleCancel = async () => {
        if (!shift) return;
        Alert.alert(
            'Cancel Shift',
            'Cancel this shift? Assigned staff will be notified.',
            [
                { text: 'Keep shift', style: 'cancel' },
                {
                    text: 'Cancel shift',
                    style: 'destructive',
                    onPress: async () => {
                        setCancelling(true);
                        try {
                            await ShiftsAPI.cancel(shift.shift_id);
                            Alert.alert('Cancelled', 'Shift has been cancelled.', [
                                { text: 'OK', onPress: () => navigation.goBack() },
                            ]);
                        } catch {
                            Alert.alert('Error', 'Could not cancel shift.');
                        } finally {
                            setCancelling(false);
                        }
                    },
                },
            ]
        );
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <SafeAreaView style={styles.safe}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (!shift) return null;

    const assignedIds     = new Set(shift.assignments.map(a => a.user_id));
    const unassignedStaff = allStaff.filter(s => !assignedIds.has(s.user_id));
    const assignedStaff   = allStaff.filter(s => assignedIds.has(s.user_id));

    const statusColor =
        shift.status === 'published' ? colors.success :
        shift.status === 'draft'     ? colors.warning :
        colors.gray;

    const statusLabel =
        shift.status === 'published' ? 'Published' :
        shift.status === 'draft'     ? 'Draft'      :
        'Cancelled';

    return (
        <SafeAreaView style={styles.safe}>

            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Shift Details</Text>
                {shift.status !== 'cancelled' && (
                    <Pressable
                        onPress={handleCancel}
                        disabled={cancelling}
                        style={styles.cancelBtn}
                    >
                        {cancelling
                            ? <ActivityIndicator size="small" color={colors.gray} />
                            : <Ionicons name="trash-outline" size={20} color="#EF4444" />
                        }
                    </Pressable>
                )}
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            >
                {/* Status + AI badge */}
                <View style={styles.statusRow}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.statusText, { color: statusColor }]}>
                            {statusLabel}
                        </Text>
                    </View>
                    {shift.created_by_ai && (
                        <View style={styles.aiBadge}>
                            <Ionicons name="sparkles" size={12} color={colors.primary} />
                            <Text style={styles.aiBadgeText}>AI Generated</Text>
                        </View>
                    )}
                </View>

                {/* Date + Time */}
                <View style={styles.card}>
                    <View style={styles.infoRow}>
                        <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                        <View>
                            <Text style={styles.infoLabel}>Date</Text>
                            <Text style={styles.infoValue}>
                                {formatDateTime(shift.start_time)}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Ionicons name="time-outline" size={18} color={colors.primary} />
                        <View>
                            <Text style={styles.infoLabel}>Time</Text>
                            <Text style={styles.infoValue}>
                                {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Ionicons name="hourglass-outline" size={18} color={colors.primary} />
                        <View>
                            <Text style={styles.infoLabel}>Duration</Text>
                            <Text style={styles.infoValue}>
                                {calcHours(shift.start_time, shift.end_time, shift.break_minutes)}
                                {shift.break_minutes > 0
                                    ? `  (${shift.break_minutes}m break)`
                                    : ''}
                            </Text>
                        </View>
                    </View>
                    {shift.role && (
                        <>
                            <View style={styles.divider} />
                            <View style={styles.infoRow}>
                                <Ionicons name="briefcase-outline" size={18} color={colors.primary} />
                                <View>
                                    <Text style={styles.infoLabel}>Role required</Text>
                                    <Text style={styles.infoValue}>{shift.role}</Text>
                                </View>
                            </View>
                        </>
                    )}
                    {shift.notes && (
                        <>
                            <View style={styles.divider} />
                            <View style={styles.infoRow}>
                                <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.infoLabel}>Notes</Text>
                                    <Text style={styles.infoValue}>{shift.notes}</Text>
                                </View>
                            </View>
                        </>
                    )}
                </View>

                {/* Assigned staff */}
                <View style={styles.card}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>
                            Assigned Staff ({assignedStaff.length})
                        </Text>
                        {shift.status !== 'cancelled' && unassignedStaff.length > 0 && (
                            <Pressable
                                onPress={() => setShowAddStaff(p => !p)}
                                style={styles.addStaffBtn}
                            >
                                <Ionicons
                                    name={showAddStaff ? 'chevron-up' : 'person-add-outline'}
                                    size={16}
                                    color={colors.primary}
                                />
                                <Text style={styles.addStaffText}>
                                    {showAddStaff ? 'Close' : 'Add'}
                                </Text>
                            </Pressable>
                        )}
                    </View>

                    {assignedStaff.length === 0 ? (
                        <Text style={styles.emptyText}>No staff assigned yet.</Text>
                    ) : (
                        assignedStaff.map(member => (
                            <View key={member.user_id} style={styles.memberRow}>
                                <View style={styles.memberAvatar}>
                                    <Text style={styles.memberAvatarText}>
                                        {(member.display_name || member.username)[0].toUpperCase()}
                                    </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.memberName}>
                                        {member.display_name || member.username}
                                    </Text>
                                    <Text style={styles.memberRole}>{member.role ?? 'Staff'}</Text>
                                </View>
                                {shift.status !== 'cancelled' && (
                                    <Pressable
                                        onPress={() => handleUnassign(member.user_id)}
                                        disabled={unassigning === member.user_id}
                                    >
                                        {unassigning === member.user_id
                                            ? <ActivityIndicator size="small" color={colors.gray} />
                                            : <Ionicons name="close-circle-outline" size={22} color="#EF4444" />
                                        }
                                    </Pressable>
                                )}
                            </View>
                        ))
                    )}

                    {/* Add staff panel */}
                    {showAddStaff && unassignedStaff.length > 0 && (
                        <View style={styles.addStaffPanel}>
                            <Text style={styles.addStaffPanelTitle}>
                                Available staff
                            </Text>
                            {unassignedStaff.map(member => (
                                <Pressable
                                    key={member.user_id}
                                    style={styles.addStaffRow}
                                    onPress={() => handleAssign(member.user_id)}
                                    disabled={assigning === member.user_id}
                                >
                                    <View style={styles.memberAvatar}>
                                        <Text style={styles.memberAvatarText}>
                                            {(member.display_name || member.username)[0].toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.memberName}>
                                            {member.display_name || member.username}
                                        </Text>
                                        <Text style={styles.memberRole}>
                                            {member.role ?? 'Staff'}
                                        </Text>
                                    </View>
                                    {assigning === member.user_id
                                        ? <ActivityIndicator size="small" color={colors.primary} />
                                        : <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                                    }
                                </Pressable>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:             { flex: 1, backgroundColor: colors.background },
    scroll:           { flex: 1 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: {
        flexDirection:     'row',
        alignItems:        'center',
        paddingHorizontal: 16,
        paddingVertical:   12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backBtn:     { padding: 4, marginRight: 8 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
    cancelBtn:   { padding: 8 },

    statusRow: {
        flexDirection: 'row',
        alignItems:    'center',
        gap:           10,
        marginBottom:  16,
    },
    statusBadge: {
        flexDirection:  'row',
        alignItems:     'center',
        gap:             6,
        paddingHorizontal: 12,
        paddingVertical:    6,
        borderRadius:   999,
    },
    statusDot:  { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: 13, fontWeight: '700' },
    aiBadge: {
        flexDirection:     'row',
        alignItems:        'center',
        gap:               4,
        paddingHorizontal: 10,
        paddingVertical:    5,
        borderRadius:      999,
        backgroundColor:   colors.subtleAccent,
        borderWidth:       1,
        borderColor:       colors.primary + '30',
    },
    aiBadgeText: { fontSize: 11, color: colors.primary, fontWeight: '700' },

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
    infoRow: {
        flexDirection: 'row',
        alignItems:    'flex-start',
        gap:           12,
        paddingVertical: 4,
    },
    infoLabel: { fontSize: 11, color: colors.gray, marginBottom: 2 },
    infoValue: { fontSize: 14, fontWeight: '600', color: colors.text },
    divider:   { height: 1, backgroundColor: '#F5F5F5', marginVertical: 10 },

    sectionHeader: {
        flexDirection:  'row',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   12,
    },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    addStaffBtn: {
        flexDirection: 'row',
        alignItems:    'center',
        gap:           4,
        paddingHorizontal: 10,
        paddingVertical:    5,
        borderRadius:  999,
        backgroundColor: colors.subtleAccent,
    },
    addStaffText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
    emptyText:    { fontSize: 13, color: colors.gray, textAlign: 'center', padding: 12 },

    memberRow: {
        flexDirection: 'row',
        alignItems:    'center',
        gap:           12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    memberAvatar: {
        width:          40,
        height:         40,
        borderRadius:   20,
        backgroundColor: colors.primary + '20',
        alignItems:     'center',
        justifyContent: 'center',
    },
    memberAvatarText: { fontSize: 16, fontWeight: '700', color: colors.primary },
    memberName:       { fontSize: 14, fontWeight: '600', color: colors.text },
    memberRole:       { fontSize: 12, color: colors.gray },

    addStaffPanel: {
        marginTop:       12,
        padding:         12,
        backgroundColor: '#F9FAFB',
        borderRadius:    10,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
    },
    addStaffPanelTitle: {
        fontSize:     12,
        fontWeight:   '700',
        color:        colors.gray,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    addStaffRow: {
        flexDirection: 'row',
        alignItems:    'center',
        gap:           12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#EFEFEF',
    },
});