// src/screens/ClockInScreen.tsx
import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TextInput,
    Alert,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import * as Location    from 'expo-location';
import { colors }       from '../theme/colors';
import { TimeEntryAPI } from '../api/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type ClockSettings = {
    clock_in_method:      string;
    break_duration_mins:  number;
    max_breaks_per_shift: number | null;
    paid_break:           boolean;
    gps_radius_meters:    number;
};

type TodayShift = {
    shift_id:   number;
    role:       string;
    start_time: string;
    end_time:   string;
    location:   string;
};

type BreakEntry = {
    break_id:         number;
    break_start:      string;
    break_end?:       string | null;
    duration_minutes?: number | null;
    is_active:        boolean;
};

type ActiveEntry = {
    entry_id:      number;
    shift_id?:     number | null;
    clock_in:      string;
    clock_out?:    string | null;
    total_minutes?: number | null;
    live_minutes:  number;
    is_active:     boolean;
    is_on_break:   boolean;
    breaks:        BreakEntry[];
    break_count:   number;
};

// ── Clock state ───────────────────────────────────────────────────────────────
type ClockState =
    | 'loading'
    | 'idle'          // not clocked in
    | 'working'       // clocked in, working
    | 'on_break'      // clocked in, on break
    | 'manager_only'; // clock-in managed by manager

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
    return `${m}m`;
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-CA', {
        hour:   '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

function formatShiftTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-CA', {
        hour:   '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClockInScreen({ navigation }: any) {
    const [clockState,   setClockState]   = useState<ClockState>('loading');
    const [activeEntry,  setActiveEntry]  = useState<ActiveEntry | null>(null);
    const [todayShift,   setTodayShift]   = useState<TodayShift | null>(null);
    const [settings,     setSettings]     = useState<ClockSettings | null>(null);
    const [liveMinutes,  setLiveMinutes]  = useState(0);
    const [breakMinutes, setBreakMinutes] = useState(0);
    const [pin,          setPin]          = useState('');
    const [submitting,   setSubmitting]   = useState(false);
    const [refreshing,   setRefreshing]   = useState(false);

    const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
    const breakTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Fetch state ───────────────────────────────────────────────────────────
    const fetchState = useCallback(async () => {
        try {
            const { data } = await TimeEntryAPI.getActive();
            const s        = data.settings  as ClockSettings;
            const entry    = data.active     as ActiveEntry | null;
            const shift    = data.today_shift as TodayShift | null;

            setSettings(s);
            setTodayShift(shift);
            setActiveEntry(entry);

            if (!entry) {
                setClockState(
                    s.clock_in_method === 'manager_only' ? 'manager_only' : 'idle'
                );
            } else if (entry.is_on_break) {
                setClockState('on_break');
                setLiveMinutes(entry.live_minutes ?? 0);
                // Calculate break duration
                const activeBrk = entry.breaks.find(b => b.is_active);
                if (activeBrk) {
                    const breakStart = new Date(activeBrk.break_start);
                    const elapsed    = Math.floor((Date.now() - breakStart.getTime()) / 60000);
                    setBreakMinutes(elapsed);
                }
            } else {
                setClockState('working');
                setLiveMinutes(entry.live_minutes ?? 0);
            }
        } catch {
            setClockState('idle');
        } finally {
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchState();
    }, [fetchState]);

    // ── Live work timer ───────────────────────────────────────────────────────
    useEffect(() => {
        if (clockState === 'working' || clockState === 'on_break') {
            timerRef.current = setInterval(() => {
                setLiveMinutes(prev => prev + 1);
            }, 60000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [clockState]);

    // ── Break timer ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (clockState === 'on_break') {
            breakTimerRef.current = setInterval(() => {
                setBreakMinutes(prev => prev + 1);
            }, 60000);
        }
        return () => {
            if (breakTimerRef.current) clearInterval(breakTimerRef.current);
        };
    }, [clockState]);

    // ── Clock in ──────────────────────────────────────────────────────────────
    const handleClockIn = async () => {
        if (!settings) return;
        setSubmitting(true);

        try {
            const body: any = {
                shift_id: todayShift?.shift_id,
            };

            // GPS mode — get location
            if (settings.clock_in_method === 'gps') {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert(
                        'Location Required',
                        'Please enable location access to clock in.',
                    );
                    setSubmitting(false);
                    return;
                }
                const loc    = await Location.getCurrentPositionAsync({});
                body.latitude  = loc.coords.latitude;
                body.longitude = loc.coords.longitude;
            }

            // PIN mode
            if (settings.clock_in_method === 'qr_pin') {
                if (pin.length !== 4) {
                    Alert.alert('Invalid PIN', 'Please enter the 4-digit PIN.');
                    setSubmitting(false);
                    return;
                }
                body.pin = pin;
            }

            await TimeEntryAPI.clockIn(body);
            setPin('');
            await fetchState();
            Alert.alert('Clocked In ✓', `You clocked in at ${new Date().toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true })}`);

        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to clock in.');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Start break ───────────────────────────────────────────────────────────
    const handleStartBreak = async () => {
        if (settings?.max_breaks_per_shift !== null &&
            (activeEntry?.break_count ?? 0) >= (settings?.max_breaks_per_shift ?? 99)) {
            Alert.alert(
                'Break Limit Reached',
                `Maximum ${settings?.max_breaks_per_shift} break(s) allowed per shift.`
            );
            return;
        }

        Alert.alert(
            'Start Break',
            `Take a ${settings?.break_duration_mins ?? 30}-minute break?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Start Break',
                    onPress: async () => {
                        setSubmitting(true);
                        try {
                            await TimeEntryAPI.startBreak();
                            setBreakMinutes(0);
                            await fetchState();
                        } catch (e: any) {
                            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to start break.');
                        } finally {
                            setSubmitting(false);
                        }
                    },
                },
            ]
        );
    };

    // ── End break ─────────────────────────────────────────────────────────────
    const handleEndBreak = async () => {
        setSubmitting(true);
        try {
            await TimeEntryAPI.endBreak();
            await fetchState();
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to end break.');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Clock out ─────────────────────────────────────────────────────────────
    const handleClockOut = () => {
        Alert.alert(
            'Clock Out',
            `Clock out now? You've worked ${formatDuration(liveMinutes)}.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clock Out',
                    style: 'destructive',
                    onPress: async () => {
                        setSubmitting(true);
                        try {
                            const { data } = await TimeEntryAPI.clockOut();
                            const totalH   = data.total_hours ?? 0;
                            setClockState('idle');
                            setActiveEntry(null);
                            setLiveMinutes(0);
                            setBreakMinutes(0);
                            Alert.alert(
                                'Great work! 🎉',
                                `Clocked out.\nTotal hours: ${totalH}h`,
                                [{
                                    text: 'View Timesheet',
                                    onPress: () => navigation.navigate('Timesheet'),
                                }, {
                                    text: 'OK',
                                }]
                            );
                        } catch (e: any) {
                            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to clock out.');
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
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Clock In / Out</Text>
                <Pressable
                    onPress={() => navigation.navigate('Timesheet')}
                    style={styles.historyBtn}
                >
                    <Ionicons name="time-outline" size={22} color={colors.primary} />
                </Pressable>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Loading ── */}
                {clockState === 'loading' && (
                    <View style={styles.centerBox}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Loading...</Text>
                    </View>
                )}

                {/* ── Manager only ── */}
                {clockState === 'manager_only' && (
                    <View style={styles.centerBox}>
                        <View style={styles.methodIconWrap}>
                            <Ionicons name="person-outline" size={40} color={colors.primary} />
                        </View>
                        <Text style={styles.methodTitle}>Manager Clock-In</Text>
                        <Text style={styles.methodSubtitle}>
                            Your company uses manager-controlled clock-in.{'\n'}
                            Please ask your manager to clock you in.
                        </Text>
                    </View>
                )}

                {/* ── IDLE — not clocked in ── */}
                {clockState === 'idle' && (
                    <>
                        {/* Today's shift */}
                        {todayShift ? (
                            <View style={styles.shiftCard}>
                                <View style={styles.shiftCardLeft}>
                                    <Text style={styles.shiftCardLabel}>TODAY'S SHIFT</Text>
                                    <Text style={styles.shiftCardRole}>{todayShift.role}</Text>
                                    <Text style={styles.shiftCardTime}>
                                        {formatShiftTime(todayShift.start_time)} – {formatShiftTime(todayShift.end_time)}
                                    </Text>
                                    <View style={styles.shiftCardLocation}>
                                        <Ionicons name="location-outline" size={13} color={colors.gray} />
                                        <Text style={styles.shiftCardLocationText}>{todayShift.location}</Text>
                                    </View>
                                </View>
                                <View style={styles.shiftCardIcon}>
                                    <Ionicons name="calendar-outline" size={28} color={colors.primary} />
                                </View>
                            </View>
                        ) : (
                            <View style={styles.noShiftCard}>
                                <Ionicons name="calendar-outline" size={24} color={colors.gray} />
                                <Text style={styles.noShiftText}>No shift assigned today</Text>
                                <Text style={styles.noShiftSub}>
                                    You can still clock in manually
                                </Text>
                            </View>
                        )}

                        {/* GPS info */}
                        {settings?.clock_in_method === 'gps' && (
                            <View style={styles.methodBanner}>
                                <Ionicons name="location-outline" size={18} color={colors.primary} />
                                <Text style={styles.methodBannerText}>
                                    GPS verification required — must be within{' '}
                                    {settings.gps_radius_meters}m of your location
                                </Text>
                            </View>
                        )}

                        {/* PIN entry */}
                        {settings?.clock_in_method === 'qr_pin' && (
                            <View style={styles.pinCard}>
                                <Text style={styles.pinLabel}>Enter today's PIN</Text>
                                <TextInput
                                    style={styles.pinInput}
                                    value={pin}
                                    onChangeText={t => setPin(t.replace(/\D/g, '').slice(0, 4))}
                                    placeholder="• • • •"
                                    placeholderTextColor={colors.gray}
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    secureTextEntry
                                    textAlign="center"
                                />
                                <Text style={styles.pinHint}>
                                    Ask your manager for today's 4-digit PIN
                                </Text>
                            </View>
                        )}

                        {/* Clock In button */}
                        <Pressable
                            style={[styles.clockInBtn, submitting && { opacity: 0.6 }]}
                            onPress={handleClockIn}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" size="large" />
                            ) : (
                                <>
                                    <Ionicons name="log-in-outline" size={28} color="#fff" />
                                    <Text style={styles.clockInBtnText}>Clock In</Text>
                                    <Text style={styles.clockInBtnSub}>
                                        {new Date().toLocaleTimeString('en-CA', {
                                            hour:   '2-digit',
                                            minute: '2-digit',
                                            hour12: true,
                                        })}
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    </>
                )}

                {/* ── WORKING — clocked in ── */}
                {clockState === 'working' && activeEntry && (
                    <>
                        {/* Live timer */}
                        <View style={styles.timerCard}>
                            <Text style={styles.timerLabel}>TIME WORKED</Text>
                            <Text style={styles.timerValue}>
                                {formatDuration(liveMinutes)}
                            </Text>
                            <Text style={styles.timerSince}>
                                Clocked in at {formatTime(activeEntry.clock_in)}
                            </Text>

                            {/* Break count */}
                            {activeEntry.break_count > 0 && (
                                <View style={styles.breakBadge}>
                                    <Ionicons name="cafe-outline" size={14} color={colors.gray} />
                                    <Text style={styles.breakBadgeText}>
                                        {activeEntry.break_count} break{activeEntry.break_count > 1 ? 's' : ''} taken
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Break limits */}
                        {settings?.max_breaks_per_shift !== null && (
                            <View style={styles.breakLimit}>
                                <Text style={styles.breakLimitText}>
                                    {activeEntry.break_count} / {settings?.max_breaks_per_shift} breaks used
                                    {settings?.paid_break ? '  •  Paid breaks' : '  •  Unpaid breaks'}
                                </Text>
                            </View>
                        )}

                        {/* Actions */}
                        <View style={styles.actionRow}>
                            <Pressable
                                style={[styles.breakBtn, submitting && { opacity: 0.6 }]}
                                onPress={handleStartBreak}
                                disabled={submitting}
                            >
                                <Ionicons name="cafe-outline" size={22} color={colors.primary} />
                                <Text style={styles.breakBtnText}>
                                    Take {settings?.break_duration_mins ?? 30}m Break
                                </Text>
                            </Pressable>
                        </View>

                        <Pressable
                            style={[styles.clockOutBtn, submitting && { opacity: 0.6 }]}
                            onPress={handleClockOut}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="log-out-outline" size={24} color="#fff" />
                                    <Text style={styles.clockOutBtnText}>Clock Out</Text>
                                </>
                            )}
                        </Pressable>
                    </>
                )}

                {/* ── ON BREAK ── */}
                {clockState === 'on_break' && activeEntry && (
                    <>
                        <View style={[styles.timerCard, styles.timerCardBreak]}>
                            <View style={styles.breakIconRow}>
                                <Ionicons name="cafe-outline" size={32} color={colors.warning} />
                            </View>
                            <Text style={[styles.timerLabel, { color: colors.warning }]}>
                                ON BREAK
                            </Text>
                            <Text style={[styles.timerValue, { color: colors.warning }]}>
                                {formatDuration(breakMinutes)}
                            </Text>

                            {/* Break duration reminder */}
                            {settings && (
                                <View style={styles.breakDurationRow}>
                                    <Text style={styles.breakDurationText}>
                                        Scheduled break: {settings.break_duration_mins}m
                                    </Text>
                                    {breakMinutes > settings.break_duration_mins && (
                                        <Text style={styles.breakOverText}>
                                            {formatDuration(breakMinutes - settings.break_duration_mins)} over
                                        </Text>
                                    )}
                                </View>
                            )}

                            <Text style={styles.timerSince}>
                                Total worked: {formatDuration(liveMinutes)}
                            </Text>
                        </View>

                        <Pressable
                            style={[styles.endBreakBtn, submitting && { opacity: 0.6 }]}
                            onPress={handleEndBreak}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="play-outline" size={22} color="#fff" />
                                    <Text style={styles.endBreakBtnText}>End Break</Text>
                                </>
                            )}
                        </Pressable>

                        <Pressable
                            style={[styles.clockOutBtn, { marginTop: 12 }, submitting && { opacity: 0.6 }]}
                            onPress={handleClockOut}
                            disabled={submitting}
                        >
                            <Ionicons name="log-out-outline" size={22} color="#fff" />
                            <Text style={styles.clockOutBtnText}>Clock Out</Text>
                        </Pressable>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:    { flex: 1, backgroundColor: '#F8F8FC' },
    scroll:  { flex: 1 },
    content: { padding: 20, paddingBottom: 60 },

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
    historyBtn:  { padding: 4 },

    centerBox: {
        alignItems:    'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap:           16,
    },
    methodIconWrap: {
        width:           80,
        height:          80,
        borderRadius:    40,
        backgroundColor: colors.subtleAccent,
        alignItems:      'center',
        justifyContent:  'center',
    },
    methodTitle:    { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
    methodSubtitle: { fontSize: 14, color: colors.gray, textAlign: 'center', lineHeight: 22 },

    loadingText: { fontSize: 14, color: colors.gray },

    // Today's shift card
    shiftCard: {
        flexDirection:   'row',
        alignItems:      'center',
        backgroundColor: '#fff',
        borderRadius:    16,
        padding:         16,
        marginBottom:    16,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        shadowColor:     '#000',
        shadowOpacity:   0.04,
        shadowRadius:    6,
        elevation:       2,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
    },
    shiftCardLeft:         { flex: 1 },
    shiftCardLabel:        { fontSize: 10, fontWeight: '800', color: colors.gray, letterSpacing: 1, marginBottom: 4 },
    shiftCardRole:         { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 2 },
    shiftCardTime:         { fontSize: 14, color: colors.text, marginBottom: 4 },
    shiftCardLocation:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
    shiftCardLocationText: { fontSize: 12, color: colors.gray },
    shiftCardIcon:         { paddingLeft: 12 },

    noShiftCard: {
        alignItems:      'center',
        backgroundColor: '#fff',
        borderRadius:    16,
        padding:         20,
        marginBottom:    16,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        gap:             6,
    },
    noShiftText: { fontSize: 15, fontWeight: '600', color: colors.text },
    noShiftSub:  { fontSize: 13, color: colors.gray },

    // Method banners
    methodBanner: {
        flexDirection:   'row',
        alignItems:      'center',
        gap:             8,
        backgroundColor: colors.subtleAccent,
        borderRadius:    12,
        padding:         12,
        marginBottom:    16,
        borderWidth:     1,
        borderColor:     colors.primary + '25',
    },
    methodBannerText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },

    // PIN entry
    pinCard: {
        backgroundColor: '#fff',
        borderRadius:    16,
        padding:         20,
        marginBottom:    16,
        alignItems:      'center',
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        gap:             10,
    },
    pinLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
    pinInput: {
        width:          160,
        borderWidth:    2,
        borderColor:    colors.primary,
        borderRadius:   14,
        paddingVertical: 14,
        fontSize:       28,
        fontWeight:     '800',
        color:          colors.text,
        letterSpacing:  12,
        textAlign:      'center',
    },
    pinHint: { fontSize: 12, color: colors.gray, textAlign: 'center' },

    // Clock in button
    clockInBtn: {
        alignItems:      'center',
        justifyContent:  'center',
        backgroundColor: colors.success,
        borderRadius:    24,
        paddingVertical: 32,
        marginTop:       8,
        gap:             6,
        shadowColor:     colors.success,
        shadowOpacity:   0.3,
        shadowRadius:    12,
        elevation:       6,
    },
    clockInBtnText: { color: '#fff', fontSize: 22, fontWeight: '800' },
    clockInBtnSub:  { color: 'rgba(255,255,255,0.8)', fontSize: 14 },

    // Timer card
    timerCard: {
        alignItems:      'center',
        backgroundColor: '#fff',
        borderRadius:    24,
        padding:         32,
        marginBottom:    16,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        shadowColor:     '#000',
        shadowOpacity:   0.06,
        shadowRadius:    12,
        elevation:       4,
        gap:             8,
    },
    timerCardBreak: {
        borderColor: colors.warning + '40',
        backgroundColor: colors.warning + '08',
    },
    timerLabel:    { fontSize: 11, fontWeight: '800', color: colors.gray, letterSpacing: 1.5 },
    timerValue:    { fontSize: 52, fontWeight: '800', color: colors.text, letterSpacing: -2 },
    timerSince:    { fontSize: 13, color: colors.gray },
    breakBadge: {
        flexDirection:   'row',
        alignItems:      'center',
        gap:             6,
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        paddingVertical:    5,
        borderRadius:    999,
    },
    breakBadgeText: { fontSize: 12, color: colors.gray },

    breakIconRow: { marginBottom: 4 },
    breakDurationRow: { alignItems: 'center', gap: 2 },
    breakDurationText: { fontSize: 13, color: colors.gray },
    breakOverText:     { fontSize: 12, color: colors.error, fontWeight: '700' },

    breakLimit: {
        backgroundColor: '#F9FAFB',
        borderRadius:    10,
        padding:         10,
        marginBottom:    12,
        alignItems:      'center',
    },
    breakLimitText: { fontSize: 12, color: colors.gray },

    // Action buttons
    actionRow: { marginBottom: 12 },
    breakBtn: {
        flexDirection:   'row',
        alignItems:      'center',
        justifyContent:  'center',
        gap:             8,
        backgroundColor: '#fff',
        borderRadius:    16,
        paddingVertical: 16,
        borderWidth:     2,
        borderColor:     colors.primary,
    },
    breakBtnText: { fontSize: 16, fontWeight: '700', color: colors.primary },

    endBreakBtn: {
        flexDirection:   'row',
        alignItems:      'center',
        justifyContent:  'center',
        gap:             8,
        backgroundColor: colors.warning,
        borderRadius:    16,
        paddingVertical: 16,
        marginBottom:    8,
        shadowColor:     colors.warning,
        shadowOpacity:   0.3,
        shadowRadius:    8,
        elevation:       4,
    },
    endBreakBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

    clockOutBtn: {
        flexDirection:   'row',
        alignItems:      'center',
        justifyContent:  'center',
        gap:             8,
        backgroundColor: colors.error,
        borderRadius:    16,
        paddingVertical: 16,
        shadowColor:     colors.error,
        shadowOpacity:   0.25,
        shadowRadius:    8,
        elevation:       4,
    },
    clockOutBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});