// src/screens/admin/ClockManagementScreen.tsx
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
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { colors }       from '../../theme/colors';
import { AdminAPI, TimeEntryAPI } from '../../api/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type StaffMember = {
    user_id:      number;
    username:     string;
    display_name?: string | null;
    email:        string;
    role?:        string | null;
    emp_id:       number;
};

type ClockSettings = {
    clock_in_method:      string;
    break_duration_mins:  number;
    max_breaks_per_shift: number | null;
    paid_break:           boolean;
    gps_radius_meters:    number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-CA', {
        hour:   '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

function minutesAgo(iso: string): string {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1)   return 'Just now';
    if (mins < 60)  return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClockManagementScreen({ navigation, route }: any) {
    const locationId = route?.params?.locationId;

    const [staff,       setStaff]       = useState<StaffMember[]>([]);
    const [settings,    setSettings]    = useState<ClockSettings | null>(null);
    const [loading,     setLoading]     = useState(true);
    const [refreshing,  setRefreshing]  = useState(false);
    const [actionUserId, setActionUserId] = useState<number | null>(null);
    const [generatedPin, setGeneratedPin] = useState<string | null>(null);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        try {
            const [staffRes, settingsRes] = await Promise.all([
                AdminAPI.listStaff(locationId),
                TimeEntryAPI.getSettings(),
            ]);
            setStaff(staffRes.data?.staff ?? []);
            setSettings(settingsRes.data?.settings ?? null);
        } catch {
            Alert.alert('Error', 'Could not load staff data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [locationId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, [fetchData]);

    // ── Manager clock in employee ─────────────────────────────────────────────
    const handleClockIn = (member: StaffMember) => {
        Alert.alert(
            'Clock In',
            `Clock in ${member.display_name || member.username}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clock In',
                    onPress: async () => {
                        setActionUserId(member.user_id);
                        try {
                            await TimeEntryAPI.managerClockIn(member.user_id);
                            Alert.alert('Done', `${member.display_name || member.username} is now clocked in.`);
                            fetchData();
                        } catch (e: any) {
                            Alert.alert('Error', e?.response?.data?.error ?? 'Failed.');
                        } finally {
                            setActionUserId(null);
                        }
                    },
                },
            ]
        );
    };

    // ── Manager clock out employee ────────────────────────────────────────────
    const handleClockOut = (member: StaffMember) => {
        Alert.alert(
            'Clock Out',
            `Clock out ${member.display_name || member.username}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text:  'Clock Out',
                    style: 'destructive',
                    onPress: async () => {
                        setActionUserId(member.user_id);
                        try {
                            await TimeEntryAPI.managerClockOut(member.user_id);
                            Alert.alert('Done', `${member.display_name || member.username} is clocked out.`);
                            fetchData();
                        } catch (e: any) {
                            Alert.alert('Error', e?.response?.data?.error ?? 'Failed.');
                        } finally {
                            setActionUserId(null);
                        }
                    },
                },
            ]
        );
    };

    // ── Generate PIN ──────────────────────────────────────────────────────────
    const handleGeneratePin = async () => {
        try {
            const { data } = await TimeEntryAPI.generatePin();
            setGeneratedPin(data.pin);
            Alert.alert(
                `Today's PIN: ${data.pin}`,
                'Share this with your staff. It expires in 24 hours.',
                [{ text: 'OK' }]
            );
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to generate PIN.');
        }
    };

    // ── Render staff row ──────────────────────────────────────────────────────
    const renderStaff = ({ item }: { item: StaffMember }) => {
        const name        = item.display_name || item.username;
        const initials    = name.trim().split(/\s+/).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
        const isActioning = actionUserId === item.user_id;

        return (
            <View style={styles.staffCard}>
                <View style={styles.staffAvatar}>
                    <Text style={styles.staffAvatarText}>{initials}</Text>
                </View>

                <View style={styles.staffInfo}>
                    <Text style={styles.staffName}>{name}</Text>
                    <Text style={styles.staffRole}>{item.role ?? 'Staff'}</Text>
                </View>

                {isActioning ? (
                    <ActivityIndicator color={colors.primary} />
                ) : (
                    <View style={styles.staffActions}>
                        <Pressable
                            style={styles.clockInSmallBtn}
                            onPress={() => handleClockIn(item)}
                        >
                            <Ionicons name="log-in-outline" size={16} color={colors.success} />
                            <Text style={[styles.clockSmallText, { color: colors.success }]}>In</Text>
                        </Pressable>
                        <Pressable
                            style={styles.clockOutSmallBtn}
                            onPress={() => handleClockOut(item)}
                        >
                            <Ionicons name="log-out-outline" size={16} color={colors.error} />
                            <Text style={[styles.clockSmallText, { color: colors.error }]}>Out</Text>
                        </Pressable>
                    </View>
                )}
            </View>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Clock Management</Text>
                <Pressable
                    onPress={() => navigation.navigate('ClockSettings')}
                    style={styles.settingsBtn}
                >
                    <Ionicons name="settings-outline" size={22} color={colors.primary} />
                </Pressable>
            </View>

            <FlatList
                data={staff}
                keyExtractor={item => String(item.user_id)}
                renderItem={renderStaff}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                    />
                }
                ListHeaderComponent={() => (
                    <>
                        {/* Settings summary */}
                        {settings && (
                            <View style={styles.settingsCard}>
                                <View style={styles.settingsRow}>
                                    <Ionicons
                                        name={
                                            settings.clock_in_method === 'gps'          ? 'location-outline' :
                                            settings.clock_in_method === 'qr_pin'       ? 'keypad-outline'   :
                                            'person-outline'
                                        }
                                        size={18}
                                        color={colors.primary}
                                    />
                                    <Text style={styles.settingsText}>
                                        {settings.clock_in_method === 'gps'
                                            ? `GPS (${settings.gps_radius_meters}m radius)`
                                            : settings.clock_in_method === 'qr_pin'
                                            ? 'PIN / QR Code'
                                            : 'Manager only'}
                                    </Text>
                                    <Text style={styles.settingsDot}>•</Text>
                                    <Text style={styles.settingsText}>
                                        {settings.break_duration_mins}m break
                                    </Text>
                                    <Text style={styles.settingsDot}>•</Text>
                                    <Text style={styles.settingsText}>
                                        {settings.paid_break ? 'Paid' : 'Unpaid'}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* PIN section */}
                        {settings?.clock_in_method === 'qr_pin' && (
                            <View style={styles.pinCard}>
                                <View style={styles.pinCardLeft}>
                                    <Text style={styles.pinCardTitle}>Daily PIN</Text>
                                    <Text style={styles.pinCardSub}>
                                        {generatedPin
                                            ? `Current PIN: ${generatedPin}`
                                            : 'Generate a PIN for staff to clock in'}
                                    </Text>
                                </View>
                                <Pressable
                                    style={styles.genPinBtn}
                                    onPress={handleGeneratePin}
                                >
                                    <Ionicons name="refresh-outline" size={16} color="#fff" />
                                    <Text style={styles.genPinBtnText}>
                                        {generatedPin ? 'New PIN' : 'Generate'}
                                    </Text>
                                </Pressable>
                            </View>
                        )}

                        <Text style={styles.listLabel}>STAFF ({staff.length})</Text>
                    </>
                )}
                ListEmptyComponent={
                    loading ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator color={colors.primary} />
                        </View>
                    ) : (
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyText}>No staff at this location</Text>
                        </View>
                    )
                }
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:        { flex: 1, backgroundColor: '#F8F8FC' },
    listContent: { padding: 16, paddingBottom: 40 },

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
    settingsBtn: { padding: 4 },

    settingsCard: {
        backgroundColor: '#fff',
        borderRadius:    12,
        padding:         12,
        marginBottom:    12,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
    },
    settingsRow: {
        flexDirection: 'row',
        alignItems:    'center',
        gap:           6,
        flexWrap:      'wrap',
    },
    settingsText: { fontSize: 12, color: colors.text, fontWeight: '600' },
    settingsDot:  { fontSize: 12, color: colors.gray },

    pinCard: {
        flexDirection:   'row',
        alignItems:      'center',
        backgroundColor: colors.subtleAccent,
        borderRadius:    12,
        padding:         14,
        marginBottom:    12,
        borderWidth:     1,
        borderColor:     colors.primary + '25',
        gap:             12,
    },
    pinCardLeft:  { flex: 1 },
    pinCardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    pinCardSub:   { fontSize: 12, color: colors.gray, marginTop: 2 },
    genPinBtn: {
        flexDirection:   'row',
        alignItems:      'center',
        gap:             6,
        backgroundColor: colors.primary,
        paddingHorizontal: 14,
        paddingVertical:   8,
        borderRadius:    999,
    },
    genPinBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },

    listLabel: {
        fontSize:      11,
        fontWeight:    '700',
        color:         colors.gray,
        letterSpacing: 0.8,
        marginBottom:  10,
        marginTop:     4,
    },

    staffCard: {
        flexDirection:   'row',
        alignItems:      'center',
        backgroundColor: '#fff',
        borderRadius:    14,
        padding:         14,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        shadowColor:     '#000',
        shadowOpacity:   0.03,
        shadowRadius:    4,
        elevation:       1,
        gap:             12,
    },
    staffAvatar: {
        width:           42,
        height:          42,
        borderRadius:    21,
        backgroundColor: colors.primary + '20',
        alignItems:      'center',
        justifyContent:  'center',
    },
    staffAvatarText: { fontSize: 16, fontWeight: '700', color: colors.primary },
    staffInfo:       { flex: 1 },
    staffName:       { fontSize: 14, fontWeight: '700', color: colors.text },
    staffRole:       { fontSize: 12, color: colors.gray, marginTop: 1 },
    staffActions:    { flexDirection: 'row', gap: 8 },

    clockInSmallBtn: {
        flexDirection:   'row',
        alignItems:      'center',
        gap:             4,
        paddingHorizontal: 12,
        paddingVertical:    7,
        borderRadius:    999,
        borderWidth:     1.5,
        borderColor:     colors.success,
        backgroundColor: colors.success + '10',
    },
    clockOutSmallBtn: {
        flexDirection:   'row',
        alignItems:      'center',
        gap:             4,
        paddingHorizontal: 12,
        paddingVertical:    7,
        borderRadius:    999,
        borderWidth:     1.5,
        borderColor:     colors.error,
        backgroundColor: colors.error + '10',
    },
    clockSmallText: { fontSize: 12, fontWeight: '700' },

    loadingBox: { alignItems: 'center', paddingVertical: 40 },
    emptyBox:   { alignItems: 'center', paddingVertical: 40 },
    emptyText:  { fontSize: 14, color: colors.gray },
});