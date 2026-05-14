// src/screens/HomeScreen.tsx
import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    ScrollView,
    RefreshControl,
    View,
    Text,
    StyleSheet,
    Pressable,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { Ionicons }      from '@expo/vector-icons';
import { useQuery }      from '@apollo/client/react';

import { colors }        from '../theme/colors';
import HeaderGreeting    from '../components/home/HeaderGreeting';
import NextShiftCard, { Shift } from '../components/home/NextShiftCard';
import QuickActionsCard  from '../components/home/QuickActionsCard';
import TeamOnDutyCard, { TeamMember } from '../components/home/TeamOnDutyCard';
import AlertsCard, { AlertItem } from '../components/home/AlertsCard';
import { AuthContext }   from '../context/AuthContext';
import { MY_LOCATIONS_QUERY } from '../graphql/operations';
import { ShiftsAPI }     from '../api/api';
import { useNotifications } from '../hooks/useNotifications';

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

type LocationOption = { id: number; name: string; address?: string | null };
type MyLocationsData = { myLocations: LocationOption[] };

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfWeek(date: Date): Date {
    const d   = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    d.setHours(0, 0, 0, 0);
    return d;
}

function formatWeekStart(date: Date): string {
    return date.toISOString().split('T')[0];
}

function isTodayShift(iso: string): boolean {
    const today = new Date();
    const d     = new Date(iso);
    return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth()    === today.getMonth()    &&
        d.getDate()     === today.getDate()
    );
}

function isUpcoming(iso: string): boolean {
    return new Date(iso) > new Date();
}

function toShiftCardShape(s: ShiftDetail, locationName: string): Shift {
    return {
        id:       String(s.shift_id),
        role:     s.role ?? 'Shift',
        location: locationName,
        startISO: s.start_time,
        endISO:   s.end_time,
    };
}

function formatShiftTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-CA', {
        hour:    '2-digit',
        minute:  '2-digit',
        hour12:  true,
    });
}

function formatShiftDay(iso: string): string {
    return new Date(iso).toLocaleDateString('en-CA', {
        weekday: 'short',
        month:   'short',
        day:     'numeric',
    });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }: any) {
    const { logout, user: authUser } = useContext(AuthContext);
    const { notifications, unreadCount } = useNotifications();

    const [myShifts,          setMyShifts]          = useState<ShiftDetail[]>([]);
    const [loadingShifts,     setLoadingShifts]     = useState(false);
    const [refreshing,        setRefreshing]        = useState(false);
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
        authUser?.primaryLocation?.id ?? null,
    );

    // ── Locations ─────────────────────────────────────────────────────────────
    const { data: locData, refetch: refetchLoc } =
        useQuery<MyLocationsData>(MY_LOCATIONS_QUERY, {
            fetchPolicy: 'cache-and-network',
        });

    const locations = locData?.myLocations ?? [];

    useEffect(() => {
        if (locations.length && !selectedLocationId) {
            const preferred = locations.find(
                l => l.id === authUser?.primaryLocation?.id
            );
            setSelectedLocationId(preferred?.id ?? locations[0].id);
        }
    }, [locations, selectedLocationId, authUser]);

    // ── My shifts (REST) ──────────────────────────────────────────────────────
    const fetchMyShifts = useCallback(async () => {
        setLoadingShifts(true);
        try {
            const weekStart = formatWeekStart(startOfWeek(new Date()));
            const { data }  = await ShiftsAPI.mine(weekStart);
            setMyShifts(data?.shifts ?? []);
        } catch (e) {
            console.warn('[HomeScreen] fetchMyShifts error:', e);
        } finally {
            setLoadingShifts(false);
        }
    }, []);

    useEffect(() => { fetchMyShifts(); }, [fetchMyShifts]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetchLoc(), fetchMyShifts()]);
        setRefreshing(false);
    }, [refetchLoc, fetchMyShifts]);

    // ── Derived shift data ────────────────────────────────────────────────────
    const locationName = useMemo(
        () => locations.find(l => l.id === selectedLocationId)?.name ?? 'My location',
        [locations, selectedLocationId],
    );

    // Today's shift
    const todayShift = useMemo(() => {
        const s = myShifts.find(s => isTodayShift(s.start_time));
        return s ? toShiftCardShape(s, locationName) : null;
    }, [myShifts, locationName]);

    // Next upcoming shift (not today)
    const nextShift = useMemo(() => {
        const now  = new Date();
        const upcoming = myShifts
            .filter(s => !isTodayShift(s.start_time) && new Date(s.start_time) > now)
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        const s = upcoming[0];
        return s ? toShiftCardShape(s, locationName) : null;
    }, [myShifts, locationName]);

    // This week's shifts — all sorted
    const weekShifts = useMemo(() =>
        [...myShifts].sort(
            (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        ),
        [myShifts],
    );

    // Hours this week
    const hoursThisWeek = useMemo(() => {
        const total = myShifts.reduce((acc, s) => {
            const diff = new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
            return acc + (diff / 3600000) - (s.break_minutes / 60);
        }, 0);
        return Math.round(total * 10) / 10;
    }, [myShifts]);

    // ── Display values ────────────────────────────────────────────────────────
    const displayName = authUser?.display_name || authUser?.username || 'Employee';
    const initials    = displayName.trim().split(/\s+/).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();

    const locationNames = useMemo(() => locations.map(l => l.name), [locations]);

    // ── Notifications → AlertItems ────────────────────────────────────────────
    const alertItems: AlertItem[] = useMemo(() =>
        notifications
            .filter(n => !n.is_read)
            .slice(0, 3)
            .map(n => ({
                id:       String(n.notif_id),
                icon:     'notifications-outline' as const,
                title:    n.title,
                subtitle: n.body,
                tone:     n.type.includes('cancel') || n.type.includes('reject')
                    ? 'warn' as const
                    : 'info' as const,
            })),
        [notifications],
    );

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing || loadingShifts}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* ── Header ── */}
                <View style={styles.headerRow}>
                    <HeaderGreeting
                        name={displayName}
                        initials={initials}
                        onAvatarPress={() => navigation.navigate?.('ProfileSettings')}
                        locations={locationNames.length ? locationNames : [locationName]}
                        selectedLocation={locationName}
                        onChangeLocation={(name) => {
                            const loc = locations.find(l => l.name === name);
                            if (loc) setSelectedLocationId(loc.id);
                        }}
                        onLogout={logout}
                    />

                    {/* Notification bell */}
                    <Pressable
                        style={styles.bellBtn}
                        onPress={() => navigation.navigate?.('Notifications')}
                    >
                        <Ionicons name="notifications-outline" size={22} color={colors.gray} />
                        {unreadCount > 0 && (
                            <View style={styles.bellBadge}>
                                <Text style={styles.bellBadgeText}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </Text>
                            </View>
                        )}
                    </Pressable>
                </View>

                {/* ── Stats bar ── */}
                <View style={styles.statsBar}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{myShifts.length}</Text>
                        <Text style={styles.statLabel}>shifts this week</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{hoursThisWeek}h</Text>
                        <Text style={styles.statLabel}>scheduled hours</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.primary }]}>
                            {unreadCount}
                        </Text>
                        <Text style={styles.statLabel}>notifications</Text>
                    </View>
                </View>

                {/* ── Today + Next shift cards ── */}
                <View style={styles.shiftRow}>
                    <NextShiftCard
                        todayShift={todayShift}
                        nextShift={nextShift}
                        onViewSchedule={() => navigation.navigate?.('Schedule')}
                    />

                    <QuickActionsCard
                        actions={[
                            {
                                icon:    'swap-horizontal',
                                label:   'Swap shift',
                                onPress: () => navigation.navigate?.('SwapShift'),
                            },
                            {
                                icon:    'checkmark-done-outline',
                                label:   'Availability',
                                onPress: () => navigation.navigate?.('Availability'),
                            },
                            {
                                icon:    'sunny-outline',
                                label:   'Time off',
                                onPress: () => navigation.navigate?.('TimeOff'),
                            },
                            {
                                icon:    'time-outline',
                                label:   'Clock in',
                                onPress: () => navigation.navigate?.('ClockIn'),
                            },
                        ]}
                    />
                </View>

                {/* ── This week's schedule ── */}
                <View style={styles.weekCard}>
                    <View style={styles.weekHeader}>
                        <Text style={styles.weekTitle}>This week</Text>
                        <Pressable onPress={() => navigation.navigate?.('Schedule')}>
                            <Text style={styles.weekSeeAll}>See schedule →</Text>
                        </Pressable>
                    </View>

                    {weekShifts.length === 0 ? (
                        <View style={styles.noShifts}>
                            <Ionicons name="calendar-outline" size={32} color={colors.inputBorder} />
                            <Text style={styles.noShiftsText}>No shifts scheduled this week</Text>
                            <Text style={styles.noShiftsSubtext}>
                                Pull down to refresh or contact your manager.
                            </Text>
                        </View>
                    ) : (
                        weekShifts.map((shift, index) => (
                            <View
                                key={shift.shift_id}
                                style={[
                                    styles.shiftRow2,
                                    index < weekShifts.length - 1 && styles.shiftRowBorder,
                                    isTodayShift(shift.start_time) && styles.shiftRowToday,
                                ]}
                            >
                                {/* Day column */}
                                <View style={styles.shiftDay}>
                                    <Text style={styles.shiftDayText}>
                                        {new Date(shift.start_time)
                                            .toLocaleDateString('en-CA', { weekday: 'short' })
                                            .toUpperCase()}
                                    </Text>
                                    <Text style={styles.shiftDayNum}>
                                        {new Date(shift.start_time).getDate()}
                                    </Text>
                                    {isTodayShift(shift.start_time) && (
                                        <View style={styles.todayDot} />
                                    )}
                                </View>

                                {/* Shift info */}
                                <View style={styles.shiftInfo}>
                                    <Text style={styles.shiftInfoRole}>
                                        {shift.role ?? 'Shift'}
                                    </Text>
                                    <Text style={styles.shiftInfoTime}>
                                        {formatShiftTime(shift.start_time)} – {formatShiftTime(shift.end_time)}
                                        {shift.break_minutes > 0
                                            ? `  •  ${shift.break_minutes}m break`
                                            : ''}
                                    </Text>
                                </View>

                                {/* Status badge */}
                                <View style={[
                                    styles.statusPill,
                                    { backgroundColor:
                                        shift.status === 'published' ? colors.success + '18'
                                        : colors.warning + '18'
                                    },
                                ]}>
                                    <Text style={[
                                        styles.statusPillText,
                                        { color:
                                            shift.status === 'published' ? colors.success
                                            : colors.warning
                                        },
                                    ]}>
                                        {shift.status === 'published' ? 'Confirmed' : 'Draft'}
                                    </Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>

                {/* ── Unread notifications ── */}
                {alertItems.length > 0 && (
                    <AlertsCard
                        alerts={alertItems}
                        onItemPress={() => navigation.navigate?.('Notifications')}
                    />
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:    { flex: 1, backgroundColor: '#F8F8FC' },
    scroll:  { flex: 1 },
    content: { padding: 16, paddingBottom: 40 },

    // Header row
    headerRow: {
        flexDirection:  'row',
        alignItems:     'flex-start',
        marginBottom:   16,
    },
    bellBtn: {
        width:          40,
        height:         40,
        borderRadius:   20,
        backgroundColor: '#fff',
        alignItems:     'center',
        justifyContent: 'center',
        marginLeft:     8,
        marginTop:      4,
        position:       'relative',
        borderWidth:    1,
        borderColor:    '#EFEFEF',
    },
    bellBadge: {
        position:        'absolute',
        top:             4,
        right:           4,
        minWidth:        16,
        height:          16,
        borderRadius:    8,
        backgroundColor: colors.error,
        alignItems:      'center',
        justifyContent:  'center',
        borderWidth:     1.5,
        borderColor:     '#F8F8FC',
    },
    bellBadgeText: { fontSize: 9, color: '#fff', fontWeight: '800' },

    // Stats bar
    statsBar: {
        flexDirection:   'row',
        backgroundColor: '#fff',
        borderRadius:    14,
        padding:         16,
        marginBottom:    16,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        shadowColor:     '#000',
        shadowOpacity:   0.03,
        shadowRadius:    4,
        elevation:       1,
    },
    statItem:    { flex: 1, alignItems: 'center' },
    statValue:   { fontSize: 20, fontWeight: '800', color: colors.text },
    statLabel:   { fontSize: 11, color: colors.gray, marginTop: 2, textAlign: 'center' },
    statDivider: { width: 1, backgroundColor: '#EFEFEF', marginHorizontal: 8 },

    // Shift cards row
    shiftRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },

    // This week card
    weekCard: {
        backgroundColor: '#fff',
        borderRadius:    14,
        padding:         16,
        marginBottom:    16,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        shadowColor:     '#000',
        shadowOpacity:   0.03,
        shadowRadius:    4,
        elevation:       1,
    },
    weekHeader: {
        flexDirection:  'row',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   12,
    },
    weekTitle:   { fontSize: 16, fontWeight: '700', color: colors.text },
    weekSeeAll:  { fontSize: 12, color: colors.primary, fontWeight: '600' },

    // No shifts
    noShifts: {
        alignItems:  'center',
        paddingVertical: 24,
        gap:         8,
    },
    noShiftsText:    { fontSize: 14, fontWeight: '600', color: colors.gray },
    noShiftsSubtext: { fontSize: 12, color: colors.gray, textAlign: 'center' },

    // Each shift row
    shiftRow2: {
        flexDirection:  'row',
        alignItems:     'center',
        paddingVertical: 10,
        gap:            12,
    },
    shiftRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    shiftRowToday: {
        backgroundColor: colors.primary + '06',
        borderRadius:    10,
        paddingHorizontal: 8,
        marginHorizontal: -8,
    },

    // Day column
    shiftDay: {
        width:      42,
        alignItems: 'center',
        position:   'relative',
    },
    shiftDayText: {
        fontSize:   10,
        fontWeight: '700',
        color:      colors.gray,
        letterSpacing: 0.5,
    },
    shiftDayNum: {
        fontSize:   18,
        fontWeight: '800',
        color:      colors.text,
    },
    todayDot: {
        width:           6,
        height:          6,
        borderRadius:    3,
        backgroundColor: colors.primary,
        marginTop:       2,
    },

    // Shift info
    shiftInfo:     { flex: 1 },
    shiftInfoRole: { fontSize: 14, fontWeight: '600', color: colors.text },
    shiftInfoTime: { fontSize: 12, color: colors.gray, marginTop: 2 },

    // Status pill
    statusPill: {
        paddingHorizontal: 10,
        paddingVertical:    4,
        borderRadius:      999,
    },
    statusPillText: { fontSize: 11, fontWeight: '700' },
});