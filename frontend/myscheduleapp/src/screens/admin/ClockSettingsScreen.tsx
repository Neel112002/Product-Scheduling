// src/screens/admin/ClockSettingsScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    ActivityIndicator,
    Alert,
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { colors }       from '../../theme/colors';
import { TimeEntryAPI } from '../../api/api';

type ClockSettings = {
    clock_in_method:      string;
    break_duration_mins:  number;
    max_breaks_per_shift: number | null;
    paid_break:           boolean;
    gps_radius_meters:    number;
};

export default function ClockSettingsScreen({ navigation }: any) {
    const [settings, setSettings] = useState<ClockSettings | null>(null);
    const [loading,  setLoading]  = useState(true);
    const [saving,   setSaving]   = useState(false);

    // Local editable state
    const [method,         setMethod]         = useState('gps');
    const [breakDuration,  setBreakDuration]  = useState(30);
    const [maxBreaks,      setMaxBreaks]      = useState<number | null>(null);
    const [paidBreak,      setPaidBreak]      = useState(false);
    const [gpsRadius,      setGpsRadius]      = useState(100);

    const fetchSettings = useCallback(async () => {
        try {
            const { data } = await TimeEntryAPI.getSettings();
            const s = data.settings as ClockSettings;
            setSettings(s);
            setMethod(s.clock_in_method);
            setBreakDuration(s.break_duration_mins);
            setMaxBreaks(s.max_breaks_per_shift);
            setPaidBreak(s.paid_break);
            setGpsRadius(s.gps_radius_meters);
        } catch {
            Alert.alert('Error', 'Could not load settings.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSettings(); }, [fetchSettings]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await TimeEntryAPI.updateSettings({
                clock_in_method:      method,
                break_duration_mins:  breakDuration,
                max_breaks_per_shift: maxBreaks,
                paid_break:           paidBreak,
                gps_radius_meters:    gpsRadius,
            });
            Alert.alert('Saved ✓', 'Clock settings updated successfully.');
            navigation.goBack();
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.safe}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Clock Settings</Text>
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
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Clock-in method ── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Clock-in Method</Text>
                    <Text style={styles.cardSub}>
                        How employees clock in for their shifts
                    </Text>

                    {[
                        {
                            value:       'gps',
                            label:       'GPS Verification',
                            description: 'Employee must be within range of the location',
                            icon:        'location-outline' as const,
                        },
                        {
                            value:       'qr_pin',
                            label:       'PIN / QR Code',
                            description: 'Employee enters a daily PIN at clock-in',
                            icon:        'keypad-outline' as const,
                        },
                        {
                            value:       'manager_only',
                            label:       'Manager Only',
                            description: 'Only managers can clock employees in/out',
                            icon:        'person-outline' as const,
                        },
                    ].map(opt => (
                        <Pressable
                            key={opt.value}
                            style={[
                                styles.methodOption,
                                method === opt.value && styles.methodOptionActive,
                            ]}
                            onPress={() => setMethod(opt.value)}
                        >
                            <View style={[
                                styles.methodIconWrap,
                                { backgroundColor: method === opt.value
                                    ? colors.primary + '20'
                                    : '#F3F4F6' },
                            ]}>
                                <Ionicons
                                    name={opt.icon}
                                    size={22}
                                    color={method === opt.value ? colors.primary : colors.gray}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[
                                    styles.methodLabel,
                                    method === opt.value && { color: colors.primary },
                                ]}>
                                    {opt.label}
                                </Text>
                                <Text style={styles.methodDesc}>{opt.description}</Text>
                            </View>
                            {method === opt.value && (
                                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                            )}
                        </Pressable>
                    ))}
                </View>

                {/* ── GPS radius ── */}
                {method === 'gps' && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>GPS Radius</Text>
                        <Text style={styles.cardSub}>
                            How close must the employee be to clock in
                        </Text>
                        <View style={styles.chipRow}>
                            {[50, 100, 200, 500].map(r => (
                                <Pressable
                                    key={r}
                                    style={[
                                        styles.chip,
                                        gpsRadius === r && styles.chipActive,
                                    ]}
                                    onPress={() => setGpsRadius(r)}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        gpsRadius === r && styles.chipTextActive,
                                    ]}>
                                        {r}m
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                )}

                {/* ── Break settings ── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Break Settings</Text>

                    <Text style={styles.fieldLabel}>Break Duration</Text>
                    <View style={styles.chipRow}>
                        {[15, 20, 30, 45, 60].map(d => (
                            <Pressable
                                key={d}
                                style={[
                                    styles.chip,
                                    breakDuration === d && styles.chipActive,
                                ]}
                                onPress={() => setBreakDuration(d)}
                            >
                                <Text style={[
                                    styles.chipText,
                                    breakDuration === d && styles.chipTextActive,
                                ]}>
                                    {d}m
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
                        Max Breaks Per Shift
                    </Text>
                    <View style={styles.chipRow}>
                        {[null, 1, 2, 3].map(n => (
                            <Pressable
                                key={String(n)}
                                style={[
                                    styles.chip,
                                    maxBreaks === n && styles.chipActive,
                                ]}
                                onPress={() => setMaxBreaks(n)}
                            >
                                <Text style={[
                                    styles.chipText,
                                    maxBreaks === n && styles.chipTextActive,
                                ]}>
                                    {n === null ? 'Unlimited' : n}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <View style={styles.switchRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.switchLabel}>Paid Breaks</Text>
                            <Text style={styles.switchSub}>
                                {paidBreak
                                    ? 'Break time is included in total hours'
                                    : 'Break time is deducted from total hours'}
                            </Text>
                        </View>
                        <Switch
                            value={paidBreak}
                            onValueChange={setPaidBreak}
                            trackColor={{ true: colors.primary }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>

                {/* ── Summary ── */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Current Configuration</Text>
                    <Text style={styles.summaryLine}>
                        Clock-in: {
                            method === 'gps'          ? `GPS (${gpsRadius}m radius)` :
                            method === 'qr_pin'       ? 'PIN / QR Code'              :
                            'Manager only'
                        }
                    </Text>
                    <Text style={styles.summaryLine}>
                        Break: {breakDuration}m • {paidBreak ? 'Paid' : 'Unpaid'} •{' '}
                        {maxBreaks === null ? 'Unlimited breaks' : `Max ${maxBreaks} break(s)`}
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe:             { flex: 1, backgroundColor: '#F8F8FC' },
    scroll:           { flex: 1 },
    content:          { padding: 16 },
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
    saveBtn: {
        paddingHorizontal: 18,
        paddingVertical:    8,
        borderRadius:      999,
        backgroundColor:   colors.primary,
        minWidth:          60,
        alignItems:        'center',
    },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

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
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
    cardSub:   { fontSize: 13, color: colors.gray, marginBottom: 14 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },

    methodOption: {
        flexDirection:   'row',
        alignItems:      'center',
        gap:             12,
        padding:         12,
        borderRadius:    12,
        borderWidth:     2,
        borderColor:     '#EFEFEF',
        backgroundColor: '#FAFAFA',
        marginBottom:    8,
    },
    methodOptionActive: {
        borderColor:     colors.primary,
        backgroundColor: colors.subtleAccent,
    },
    methodIconWrap: {
        width:          44,
        height:         44,
        borderRadius:   22,
        alignItems:     'center',
        justifyContent: 'center',
    },
    methodLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    methodDesc:  { fontSize: 12, color: colors.gray, marginTop: 2 },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingHorizontal: 16,
        paddingVertical:    8,
        borderRadius:      999,
        borderWidth:       1.5,
        borderColor:       colors.inputBorder,
        backgroundColor:   '#FAFAFA',
    },
    chipActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText:       { fontSize: 13, fontWeight: '600', color: colors.text },
    chipTextActive: { color: '#fff' },

    switchRow: {
        flexDirection:  'row',
        alignItems:     'center',
        gap:            12,
        marginTop:      16,
        paddingTop:     16,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    switchSub:   { fontSize: 12, color: colors.gray, marginTop: 2 },

    summaryCard: {
        backgroundColor: colors.subtleAccent,
        borderRadius:    14,
        padding:         14,
        borderWidth:     1,
        borderColor:     colors.primary + '20',
        gap:             6,
    },
    summaryTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
    summaryLine:  { fontSize: 13, color: colors.gray },
});