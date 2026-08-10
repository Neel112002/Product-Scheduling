// src/screens/admin/EmployeeProfileScreen.tsx
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
import { Ionicons }     from '@expo/vector-icons';
import { colors }       from '../../theme/colors';
import { AdminAPI }     from '../../api/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type EmployeeProfile = {
    user_id:            number;
    username:           string;
    display_name?:      string | null;
    user_email:         string;
    emp_id:             number;
    role?:              string | null;
    role_id:            number;
    status:             string;
    employment_type:    'full_time' | 'part_time' | 'casual';
    hourly_rate?:       number | null;
    max_hours_week?:    number | null;
    overtime_eligible:  boolean;
    phone?:             string | null;
    emergency_contact?: string | null;
    emergency_phone?:   string | null;
    notes?:             string | null;
    hire_date?:         string | null;
    location_id:        number;
};

// ── Employment type options ───────────────────────────────────────────────────

const EMP_TYPES = [
    { value: 'full_time', label: 'Full-time', icon: 'briefcase-outline' as const, color: colors.primary },
    { value: 'part_time', label: 'Part-time', icon: 'time-outline'      as const, color: '#F59E0B'       },
    { value: 'casual',    label: 'Casual',    icon: 'calendar-outline'  as const, color: '#10B981'       },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-CA', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
}

function getInitials(name: string): string {
    return name.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmployeeProfileScreen({ route, navigation }: any) {
    const { userId, locationId } = route.params ?? {};

    const [profile,  setProfile]  = useState<EmployeeProfile | null>(null);
    const [loading,  setLoading]  = useState(true);
    const [saving,   setSaving]   = useState(false);
    const [editing,  setEditing]  = useState(false);

    // ── Editable state ────────────────────────────────────────────────────────
    const [hourlyRate,       setHourlyRate]       = useState('');
    const [employmentType,   setEmploymentType]   = useState<'full_time' | 'part_time' | 'casual'>('full_time');
    const [maxHours,         setMaxHours]         = useState('');
    const [overtimeEligible, setOvertimeEligible] = useState(true);
    const [phone,            setPhone]            = useState('');
    const [emergencyContact, setEmergencyContact] = useState('');
    const [emergencyPhone,   setEmergencyPhone]   = useState('');
    const [notes,            setNotes]            = useState('');
    const [status,           setStatus]           = useState<'active' | 'inactive'>('active');

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchProfile = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await AdminAPI.getEmployeeProfile(userId);
            const p        = data.profile as EmployeeProfile;
            setProfile(p);
            setHourlyRate(p.hourly_rate       ? String(p.hourly_rate)   : '');
            setEmploymentType(p.employment_type  ?? 'full_time');
            setMaxHours(p.max_hours_week        ? String(p.max_hours_week) : '');
            setOvertimeEligible(p.overtime_eligible ?? true);
            setPhone(p.phone                   ?? '');
            setEmergencyContact(p.emergency_contact ?? '');
            setEmergencyPhone(p.emergency_phone    ?? '');
            setNotes(p.notes                   ?? '');
            setStatus((p.status as 'active' | 'inactive') ?? 'active');
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Could not load profile.');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => { fetchProfile(); }, [fetchProfile]);

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        try {
            await AdminAPI.updateEmployeeProfile(userId, {
                hourly_rate:       hourlyRate ? parseFloat(hourlyRate) : null,
                employment_type:   employmentType,
                max_hours_week:    maxHours ? parseInt(maxHours) : null,
                overtime_eligible: overtimeEligible,
                phone,
                emergency_contact: emergencyContact,
                emergency_phone:   emergencyPhone,
                notes,
                status,
            });
            await fetchProfile();
            setEditing(false);
            Alert.alert('Saved ✓', 'Employee profile updated.');
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    // ── Toggle status ─────────────────────────────────────────────────────────
    const handleToggleStatus = () => {
        const newStatus  = status === 'active' ? 'inactive' : 'active';
        const personName = profile?.display_name || profile?.username;
        Alert.alert(
            newStatus === 'inactive' ? 'Deactivate Employee' : 'Reactivate Employee',
            newStatus === 'inactive'
                ? `Remove ${personName} from active staff? They won't appear on schedules.`
                : `Reactivate ${personName}? They will appear on schedules again.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text:  newStatus === 'inactive' ? 'Deactivate' : 'Reactivate',
                    style: newStatus === 'inactive' ? 'destructive' : 'default',
                    onPress: async () => {
                        try {
                            await AdminAPI.updateEmployeeProfile(userId, { status: newStatus });
                            setStatus(newStatus);
                            await fetchProfile();
                            Alert.alert('Updated', `Employee is now ${newStatus}.`);
                        } catch {
                            Alert.alert('Error', 'Failed to update status.');
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

    if (!profile) return null;

    const name    = profile.display_name || profile.username;
    const empType = EMP_TYPES.find(t => t.value === employmentType) ?? EMP_TYPES[0];

    const weeklyEarnings = hourlyRate && maxHours
        ? `$${(parseFloat(hourlyRate) * parseInt(maxHours)).toFixed(0)}/wk est.`
        : null;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>

            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Employee Profile</Text>
                {editing ? (
                    <Pressable
                        onPress={handleSave}
                        disabled={saving}
                        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                    >
                        {saving
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text style={styles.saveBtnText}>Save</Text>
                        }
                    </Pressable>
                ) : (
                    <Pressable onPress={() => setEditing(true)} style={styles.editBtn}>
                        <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                    </Pressable>
                )}
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Hero card ── */}
                <View style={styles.heroCard}>
                    <View style={styles.heroAvatar}>
                        <Text style={styles.heroAvatarText}>{getInitials(name)}</Text>
                    </View>
                    <Text style={styles.heroName}>{name}</Text>
                    <Text style={styles.heroEmail}>{profile.user_email}</Text>

                    <View style={styles.heroBadges}>
                        <View style={styles.heroBadge}>
                            <Ionicons name="shield-outline" size={13} color={colors.primary} />
                            <Text style={styles.heroBadgeText}>{profile.role ?? 'Staff'}</Text>
                        </View>
                        <View style={[styles.heroBadge, { backgroundColor: empType.color + '15' }]}>
                            <Ionicons name={empType.icon} size={13} color={empType.color} />
                            <Text style={[styles.heroBadgeText, { color: empType.color }]}>
                                {empType.label}
                            </Text>
                        </View>
                        <View style={[
                            styles.heroBadge,
                            { backgroundColor: status === 'active' ? colors.success + '15' : colors.error + '15' },
                        ]}>
                            <View style={[
                                styles.statusDot,
                                { backgroundColor: status === 'active' ? colors.success : colors.error },
                            ]} />
                            <Text style={[
                                styles.heroBadgeText,
                                { color: status === 'active' ? colors.success : colors.error },
                            ]}>
                                {status === 'active' ? 'Active' : 'Inactive'}
                            </Text>
                        </View>
                    </View>

                    {profile.hire_date && (
                        <Text style={styles.hireDate}>
                            Hired {formatDate(profile.hire_date)}
                        </Text>
                    )}
                </View>

                {/* ── Employment type ── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Employment Type</Text>
                    <View style={styles.typeRow}>
                        {EMP_TYPES.map(t => (
                            <Pressable
                                key={t.value}
                                style={[
                                    styles.typeChip,
                                    employmentType === t.value && {
                                        borderColor:     t.color,
                                        backgroundColor: t.color + '12',
                                    },
                                    !editing && employmentType !== t.value && { opacity: 0.4 },
                                ]}
                                onPress={() => editing && setEmploymentType(t.value as any)}
                                disabled={!editing}
                            >
                                <Ionicons
                                    name={t.icon}
                                    size={18}
                                    color={employmentType === t.value ? t.color : colors.gray}
                                />
                                <Text style={[
                                    styles.typeChipText,
                                    employmentType === t.value && { color: t.color, fontWeight: '700' },
                                ]}>
                                    {t.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* ── Compensation ── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Compensation</Text>

                    <View style={styles.fieldRow}>
                        <View style={styles.fieldHalf}>
                            <Text style={styles.fieldLabel}>Hourly rate ($)</Text>
                            <TextInput
                                style={[styles.input, !editing && styles.inputReadonly]}
                                value={hourlyRate}
                                onChangeText={setHourlyRate}
                                placeholder="e.g. 18.50"
                                placeholderTextColor={colors.gray}
                                keyboardType="decimal-pad"
                                editable={editing}
                            />
                        </View>
                        <View style={styles.fieldHalf}>
                            <Text style={styles.fieldLabel}>Max hours/week</Text>
                            <TextInput
                                style={[styles.input, !editing && styles.inputReadonly]}
                                value={maxHours}
                                onChangeText={setMaxHours}
                                placeholder="e.g. 40"
                                placeholderTextColor={colors.gray}
                                keyboardType="number-pad"
                                editable={editing}
                            />
                        </View>
                    </View>

                    {weeklyEarnings && (
                        <View style={styles.earningsRow}>
                            <Ionicons name="calculator-outline" size={14} color={colors.success} />
                            <Text style={styles.earningsText}>Estimated: {weeklyEarnings}</Text>
                        </View>
                    )}

                    <View style={styles.switchRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.switchLabel}>Overtime eligible</Text>
                            <Text style={styles.switchSub}>
                                Eligible for overtime pay after 40h/week
                            </Text>
                        </View>
                        <Switch
                            value={overtimeEligible}
                            onValueChange={setOvertimeEligible}
                            disabled={!editing}
                            trackColor={{ true: colors.primary }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>

                {/* ── Contact info ── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Contact Information</Text>

                    <Text style={styles.fieldLabel}>Phone number</Text>
                    <TextInput
                        style={[styles.input, !editing && styles.inputReadonly, { marginBottom: 12 }]}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="e.g. +1 (416) 555-0123"
                        placeholderTextColor={colors.gray}
                        keyboardType="phone-pad"
                        editable={editing}
                    />

                    <Text style={styles.fieldLabel}>Emergency contact name</Text>
                    <TextInput
                        style={[styles.input, !editing && styles.inputReadonly, { marginBottom: 12 }]}
                        value={emergencyContact}
                        onChangeText={setEmergencyContact}
                        placeholder="e.g. Jane Doe (Mother)"
                        placeholderTextColor={colors.gray}
                        editable={editing}
                    />

                    <Text style={styles.fieldLabel}>Emergency contact phone</Text>
                    <TextInput
                        style={[styles.input, !editing && styles.inputReadonly]}
                        value={emergencyPhone}
                        onChangeText={setEmergencyPhone}
                        placeholder="e.g. +1 (416) 555-0456"
                        placeholderTextColor={colors.gray}
                        keyboardType="phone-pad"
                        editable={editing}
                    />
                </View>

                {/* ── Manager notes ── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Manager Notes</Text>
                    <Text style={styles.cardSub}>Private — only visible to managers and owners</Text>
                    <TextInput
                        style={[styles.notesInput, !editing && styles.inputReadonly]}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="e.g. Strong barista skills, prefers morning shifts..."
                        placeholderTextColor={colors.gray}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        editable={editing}
                    />
                </View>

                {/* ── Summary stats ── */}
                <View style={styles.statsCard}>
                    <Text style={styles.cardTitle}>Employment Summary</Text>
                    <View style={styles.statsRow}>
                        <StatItem
                            icon="briefcase-outline"
                            label="Type"
                            value={empType.label}
                            color={empType.color}
                        />
                        <StatItem
                            icon="cash-outline"
                            label="Rate"
                            value={hourlyRate ? `$${parseFloat(hourlyRate).toFixed(2)}/h` : '—'}
                            color={colors.success}
                        />
                        <StatItem
                            icon="time-outline"
                            label="Max hrs"
                            value={maxHours ? `${maxHours}h/wk` : '—'}
                            color="#F59E0B"
                        />
                    </View>
                </View>

                {/* ── Danger zone ── */}
                <View style={styles.dangerCard}>
                    <Pressable style={styles.dangerRow} onPress={handleToggleStatus}>
                        <View style={[
                            styles.dangerIconWrap,
                            { backgroundColor: status === 'active'
                                ? colors.error   + '12'
                                : colors.success + '12' },
                        ]}>
                            <Ionicons
                                name={status === 'active' ? 'person-remove-outline' : 'person-add-outline'}
                                size={20}
                                color={status === 'active' ? colors.error : colors.success}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[
                                styles.dangerTitle,
                                { color: status === 'active' ? colors.error : colors.success },
                            ]}>
                                {status === 'active' ? 'Deactivate employee' : 'Reactivate employee'}
                            </Text>
                            <Text style={styles.dangerSub}>
                                {status === 'active'
                                    ? 'Remove from active schedules'
                                    : 'Restore to active staff list'}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.gray} />
                    </Pressable>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ── StatItem ──────────────────────────────────────────────────────────────────

function StatItem({
    icon, label, value, color,
}: {
    icon:  React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    value: string;
    color: string;
}) {
    return (
        <View style={statStyles.item}>
            <View style={[statStyles.iconWrap, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={18} color={color} />
            </View>
            <Text style={[statStyles.value, { color }]}>{value}</Text>
            <Text style={statStyles.label}>{label}</Text>
        </View>
    );
}

const statStyles = StyleSheet.create({
    item:    { flex: 1, alignItems: 'center', gap: 4 },
    iconWrap: {
        width:          36,
        height:         36,
        borderRadius:   18,
        alignItems:     'center',
        justifyContent: 'center',
    },
    value: { fontSize: 13, fontWeight: '700' },
    label: { fontSize: 11, color: colors.gray },
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:             { flex: 1, backgroundColor: '#F8F8FC' },
    scroll:           { flex: 1 },
    content:          { padding: 16, paddingBottom: 40 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
    editBtn: {
        width:           36,
        height:          36,
        borderRadius:    18,
        backgroundColor: colors.subtleAccent,
        alignItems:      'center',
        justifyContent:  'center',
    },
    saveBtn: {
        paddingHorizontal: 18,
        paddingVertical:    8,
        borderRadius:      999,
        backgroundColor:   colors.primary,
        minWidth:          60,
        alignItems:        'center',
    },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    heroCard: {
        alignItems:      'center',
        backgroundColor: '#fff',
        borderRadius:    16,
        padding:         20,
        marginBottom:    12,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        gap:             6,
    },
    heroAvatar: {
        width:           72,
        height:          72,
        borderRadius:    36,
        backgroundColor: colors.primary,
        alignItems:      'center',
        justifyContent:  'center',
        marginBottom:    4,
        shadowColor:     colors.primary,
        shadowOpacity:   0.25,
        shadowRadius:    8,
        elevation:       4,
    },
    heroAvatarText: { fontSize: 26, fontWeight: '800', color: '#fff' },
    heroName:       { fontSize: 20, fontWeight: '800', color: colors.text },
    heroEmail:      { fontSize: 13, color: colors.gray },
    heroBadges: {
        flexDirection:  'row',
        flexWrap:       'wrap',
        gap:            8,
        justifyContent: 'center',
        marginTop:      4,
    },
    heroBadge: {
        flexDirection:     'row',
        alignItems:        'center',
        gap:               4,
        backgroundColor:   colors.subtleAccent,
        paddingHorizontal: 10,
        paddingVertical:    4,
        borderRadius:      999,
    },
    heroBadgeText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
    statusDot:     { width: 6, height: 6, borderRadius: 3 },
    hireDate:      { fontSize: 12, color: colors.gray, marginTop: 2 },

    card: {
        backgroundColor: '#fff',
        borderRadius:    16,
        padding:         16,
        marginBottom:    12,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        shadowColor:     '#000',
        shadowOpacity:   0.03,
        shadowRadius:    4,
        elevation:       1,
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4  },
    cardSub:   { fontSize: 12, color: colors.gray,                    marginBottom: 12 },

    typeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    typeChip: {
        flex:            1,
        alignItems:      'center',
        gap:             6,
        paddingVertical: 12,
        borderRadius:    12,
        borderWidth:     1.5,
        borderColor:     colors.inputBorder,
        backgroundColor: '#FAFAFA',
    },
    typeChipText: { fontSize: 12, fontWeight: '600', color: colors.text },

    fieldRow:  { flexDirection: 'row', gap: 12, marginBottom: 12 },
    fieldHalf: { flex: 1 },
    fieldLabel: {
        fontSize:     12,
        fontWeight:   '600',
        color:        colors.text,
        marginBottom: 6,
    },
    input: {
        borderWidth:       1,
        borderColor:       colors.inputBorder,
        borderRadius:      10,
        paddingHorizontal: 12,
        paddingVertical:   10,
        fontSize:          14,
        color:             colors.text,
        backgroundColor:   '#FAFAFA',
    },
    inputReadonly: { backgroundColor: '#F5F5F5', color: colors.gray },
    notesInput: {
        borderWidth:       1,
        borderColor:       colors.inputBorder,
        borderRadius:      10,
        paddingHorizontal: 12,
        paddingVertical:   10,
        fontSize:          14,
        color:             colors.text,
        backgroundColor:   '#FAFAFA',
        minHeight:         100,
    },

    earningsRow: {
        flexDirection:   'row',
        alignItems:      'center',
        gap:             6,
        backgroundColor: colors.success + '10',
        borderRadius:    8,
        padding:         8,
        marginBottom:    12,
    },
    earningsText: { fontSize: 12, color: colors.success, fontWeight: '600' },

    switchRow: {
        flexDirection:  'row',
        alignItems:     'center',
        gap:            12,
        marginTop:      12,
        paddingTop:     12,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    switchSub:   { fontSize: 12, color: colors.gray, marginTop: 2 },

    statsCard: {
        backgroundColor: '#fff',
        borderRadius:    16,
        padding:         16,
        marginBottom:    12,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
    },
    statsRow: { flexDirection: 'row', marginTop: 12, gap: 8 },

    dangerCard: {
        backgroundColor: '#fff',
        borderRadius:    16,
        marginBottom:    12,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        overflow:        'hidden',
    },
    dangerRow: {
        flexDirection:     'row',
        alignItems:        'center',
        paddingHorizontal: 16,
        paddingVertical:   14,
        gap:               12,
    },
    dangerIconWrap: {
        width:          40,
        height:         40,
        borderRadius:   20,
        alignItems:     'center',
        justifyContent: 'center',
    },
    dangerTitle: { fontSize: 15, fontWeight: '600' },
    dangerSub:   { fontSize: 12, color: colors.gray, marginTop: 2 },
});