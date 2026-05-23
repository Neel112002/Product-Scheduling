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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@apollo/client/react';

import { colors } from '../theme/colors';
import HeaderGreeting from '../components/home/HeaderGreeting';
import QuickActionsCard from '../components/home/QuickActionsCard';
import AlertsCard, { AlertItem } from '../components/home/AlertsCard';
import TodayShiftStatusCard from '../components/home/TodayShiftStatusCard';
import { AuthContext } from '../context/AuthContext';
import { ShiftsAPI, TimeEntryAPI } from '../api/api';
import { useNotifications } from '../hooks/useNotifications';
import { MY_LOCATIONS_QUERY } from '../graphql/operations';

// ── Types ─────────────────────────────────────────────────────────────────────

type ShiftDetail = {
    shift_id: number;
    location_id: number;
    role?: string | null;
    start_time: string;
    end_time: string;
    break_minutes: number;
    status: string;
    assignments: { user_id: number }[];
};

type ActiveEntry = {
    entry_id: number;
    shift_id?: number | null;
    clock_in: string;
    clock_out?: string | null;
    total_minutes?: number | null;
    live_minutes: number;
    is_active: boolean;
    is_on_break: boolean;
    breaks: any[];
    break_count: number;
};

type TodayShift = {
    shift_id: number;
    role?: string | null;
    start_time: string;
    end_time: string;
    location?: string | null;
};

type ClockSettings = { break_duration_mins: number };

type TeamMemberStatus = {
    user_id: number;
    name: string;
    initials: string;
    role: string;
    status: 'working' | 'on_break' | 'late' | 'scheduled';
    shift_start?: string | null;
    shift_end?: string | null;
    clocked_in?: string | null;
};

type LocationOption = { id: number; name: string };
type MyLocationsData = { myLocations: LocationOption[] };

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
    working: { color: '#10B981', label: 'Working' },
    on_break: { color: '#F59E0B', label: 'On break' },
    late: { color: '#EF4444', label: 'Late' },
    scheduled: { color: '#6366F1', label: 'Scheduled' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfWeek(): string {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
}

function isTodayShift(iso: string): boolean {
    const d = new Date(iso);
    const today = new Date();
    return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
    );
}

function formatShiftTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-CA', {
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
}

function formatShiftDay(iso: string): string {
    const d = new Date(iso);
    return (
        d.toLocaleDateString('en-CA', { weekday: 'short' }).toUpperCase() +
        ' ' + d.getDate()
    );
}

function calcHours(start: string, end: string, breakMins: number): string {
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
    const net = Math.max(diff - breakMins, 0);
    const h = Math.floor(net / 60);
    const m = net % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }: any) {
    const { logout, user: authUser } = useContext(AuthContext);
    const { notifications, unreadCount } = useNotifications();

    const [myShifts, setMyShifts] = useState<ShiftDetail[]>([]);
    const [activeEntry, setActiveEntry] = useState<ActiveEntry | null>(null);
    const [todayShift, setTodayShift] = useState<TodayShift | null>(null);
    const [clockSettings, setClockSettings] = useState<ClockSettings | null>(null);
    const [teamStatus, setTeamStatus] = useState<TeamMemberStatus[]>([]);
    const [loadingShifts, setLoadingShifts] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
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
            const preferred = locations.find(l => l.id === authUser?.primaryLocation?.id);
            setSelectedLocationId(preferred?.id ?? locations[0].id);
        }
    }, [locations, selectedLocationId, authUser]);

    // ── My shifts ─────────────────────────────────────────────────────────────
    const fetchMyShifts = useCallback(async () => {
        setLoadingShifts(true);
        try {
            const { data } = await ShiftsAPI.mine(startOfWeek());
            setMyShifts(data?.shifts ?? []);
        } catch {
            setMyShifts([]);
        } finally {
            setLoadingShifts(false);
        }
    }, []);

    useEffect(() => { fetchMyShifts(); }, [fetchMyShifts]);

    // ── Active clock entry ────────────────────────────────────────────────────
    const fetchActiveEntry = useCallback(async () => {
        try {
            const { data } = await TimeEntryAPI.getActive();
            setActiveEntry(data.active ?? null);
            setTodayShift(data.today_shift ?? null);
            setClockSettings(data.settings ?? null);
        } catch {
            setActiveEntry(null);
        }
    }, []);

    useEffect(() => { fetchActiveEntry(); }, [fetchActiveEntry]);

    // Refresh active entry every 60s
    useEffect(() => {
        const interval = setInterval(fetchActiveEntry, 60_000);
        return () => clearInterval(interval);
    }, [fetchActiveEntry]);

    // ── Team status ───────────────────────────────────────────────────────────
    const fetchTeamStatus = useCallback(async () => {
        if (!selectedLocationId) return;
        try {
            const { data } = await TimeEntryAPI.getTeamStatus(selectedLocationId);
            setTeamStatus((data?.team ?? []).slice(0, 3));
        } catch {
            setTeamStatus([]);
        }
    }, [selectedLocationId]);

    useEffect(() => { fetchTeamStatus(); }, [fetchTeamStatus]);

    useEffect(() => {
        const interval = setInterval(fetchTeamStatus, 60_000);
        return () => clearInterval(interval);
    }, [fetchTeamStatus]);

    // ── Refresh ───────────────────────────────────────────────────────────────
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([
            refetchLoc(),
            fetchMyShifts(),
            fetchActiveEntry(),
            fetchTeamStatus(),
        ]);
        setRefreshing(false);
    }, [refetchLoc, fetchMyShifts, fetchActiveEntry, fetchTeamStatus]);

    // ── Derived ───────────────────────────────────────────────────────────────
    const sortedShifts = useMemo(() =>
        [...myShifts].sort(
            (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        ), [myShifts]);

    const upcomingShifts = useMemo(
        () => sortedShifts.filter(s => !isTodayShift(s.start_time)),
        [sortedShifts]
    );

    const hoursThisWeek = useMemo(() => {
        const total = myShifts.reduce((acc, s) => {
            const diff = new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
            return acc + (diff / 3600000) - (s.break_minutes / 60);
        }, 0);
        return Math.round(total * 10) / 10;
    }, [myShifts]);

    const displayName = authUser?.display_name || authUser?.username || 'Employee';
    const initials = displayName.trim().split(/\s+/).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
    const locationName = useMemo(
        () => locations.find(l => l.id === selectedLocationId)?.name ?? 'My location',
        [locations, selectedLocationId],
    );
    const locationNames = useMemo(() => locations.map(l => l.name), [locations]);

    const alertItems: AlertItem[] = useMemo(() =>
        notifications
            .filter(n => !n.is_read)
            .slice(0, 3)
            .map(n => ({
                id: String(n.notif_id),
                icon: 'notifications-outline' as const,
                title: n.title,
                subtitle: n.body,
                tone: n.type.includes('cancel') || n.type.includes('reject')
                    ? 'warn' as const : 'info' as const,
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
                {/* Header */}
                <View style={styles.headerRow}>
                    <HeaderGreeting
                        name={displayName}
                        initials={initials}
                        onAvatarPress={() => navigation.navigate('ProfileSettings')}
                        locations={locationNames.length ? locationNames : [locationName]}
                        selectedLocation={locationName}
                        onChangeLocation={(name: string) => {
                            const loc = locations.find(l => l.name === name);
                            if (loc) setSelectedLocationId(loc.id);
                        }}
                        onLogout={logout}
                    />
                    <Pressable
                        style={styles.bellBtn}
                        onPress={() => navigation.navigate('Notifications')}
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

                {/* Stats bar */}
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

                {/* ── Today's shift status card ── */}
                <View style={styles.shiftStatusSection}>
                    <Text style={styles.sectionLabel}>TODAY</Text>
                    <TodayShiftStatusCard
                        todayShift={todayShift}
                        activeEntry={activeEntry}
                        settings={clockSettings}
                        onClockIn={() => navigation.navigate('ClockIn')}
                        onClockOut={() => navigation.navigate('ClockIn')}
                        onBreak={() => navigation.navigate('ClockIn')}
                        onTimesheet={() => navigation.navigate('Timesheet')}
                    />
                </View>

                {/* My Shifts + Quick Actions */}
                <View style={styles.mainRow}>
                    <View style={styles.shiftsCard}>
                        <View style={styles.shiftsCardHeader}>
                            <Text style={styles.shiftsCardTitle}>My Shifts</Text>
                            <Pressable
                                style={styles.calendarBtn}
                                onPress={() => navigation.navigate('Schedule', {
                                    locationId: selectedLocationId,
                                    readOnly: true,
                                })}
                            >
                                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                            </Pressable>
                        </View>

                        {upcomingShifts.length > 0 ? (
                            <>
                                <Text style={styles.shiftGroupLabel}>UPCOMING</Text>
                                {upcomingShifts.map(s => (
                                    <ShiftRow key={s.shift_id} shift={s} />
                                ))}
                            </>
                        ) : (
                            <View style={styles.emptyShifts}>
                                <Ionicons name="calendar-outline" size={24} color={colors.inputBorder} />
                                <Text style={styles.emptyShiftsText}>
                                    No upcoming shifts this week
                                </Text>
                            </View>
                        )}
                    </View>

                    <QuickActionsCard
                        actions={[
                            {
                                icon: 'swap-horizontal',
                                label: 'Swap shift',
                                onPress: () => navigation.navigate('SwapShift'),
                            },
                            {
                                icon: 'checkmark-done-outline',
                                label: 'Availability',
                                onPress: () => navigation.navigate('Availability'),
                            },
                            {
                                icon: 'sunny-outline',
                                label: 'Time off',
                                onPress: () => navigation.navigate('TimeOff'),
                            },
                            {
                                icon: 'time-outline',
                                label: 'Clock in',
                                onPress: () => navigation.navigate('ClockIn'),
                            },
                        ]}
                    />
                </View>

                {/* Today's Team */}
                <TeamStatusCard
                    members={teamStatus}
                    onViewAll={() => navigation.navigate('TeamStatus', {
                        locationId: selectedLocationId,
                    })}
                />

                {/* Alerts */}
                {alertItems.length > 0 && (
                    <AlertsCard
                        alerts={alertItems}
                        onItemPress={() => navigation.navigate('Notifications')}
                    />
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ── ShiftRow ──────────────────────────────────────────────────────────────────

function ShiftRow({ shift }: { shift: ShiftDetail }) {
    const statusColor = shift.status === 'published' ? colors.success : colors.warning;

    return (
        <View style={rowStyles.row}>
            <View style={rowStyles.dayBadge}>
                <Text style={rowStyles.dayText}>{formatShiftDay(shift.start_time)}</Text>
            </View>
            <View style={rowStyles.info}>
                <Text style={rowStyles.role} numberOfLines={1}>{shift.role ?? 'Shift'}</Text>
                <Text style={rowStyles.time}>
                    {formatShiftTime(shift.start_time)} – {formatShiftTime(shift.end_time)}
                    {'  ·  '}{calcHours(shift.start_time, shift.end_time, shift.break_minutes)}
                </Text>
            </View>
            <View style={[rowStyles.pill, { backgroundColor: statusColor + '18' }]}>
                <Text style={[rowStyles.pillText, { color: statusColor }]}>
                    {shift.status === 'published' ? 'Confirmed' : 'Draft'}
                </Text>
            </View>
        </View>
    );
}

const rowStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    dayBadge: {
        minWidth: 44,
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    dayText: { fontSize: 9, fontWeight: '800', color: colors.gray, letterSpacing: 0.5 },
    info: { flex: 1 },
    role: { fontSize: 12, fontWeight: '700', color: colors.text },
    time: { fontSize: 11, color: colors.gray, marginTop: 1 },
    pill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
    pillText: { fontSize: 9, fontWeight: '800' },
});

// ── TeamStatusCard ────────────────────────────────────────────────────────────

function TeamStatusCard({
    members,
    onViewAll,
}: {
    members: TeamMemberStatus[];
    onViewAll: () => void;
}) {
    return (
        <View style={teamStyles.card}>
            <View style={teamStyles.cardHeader}>
                <Text style={teamStyles.title}>Today's Team</Text>
                <Pressable onPress={onViewAll} style={teamStyles.viewAllBtn}>
                    <Text style={teamStyles.viewAllText}>View all</Text>
                    <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                </Pressable>
            </View>

            {members.length === 0 ? (
                <View style={teamStyles.emptyRow}>
                    {(() => {
                        const hour = new Date().getHours();
                        const isDay = hour >= 6 && hour < 20;
                        return (
                            <Ionicons
                                name={isDay ? 'sunny-outline' : 'moon-outline'}
                                size={18}
                                color={isDay ? '#F59E0B' : '#6366F1'}
                            />
                        );
                    })()}
                    <Text style={teamStyles.emptyText}>No one is working today</Text>
                </View>
            ) : (
                <>
                    <View style={teamStyles.memberRow}>
                        {members.map(member => {
                            const cfg = STATUS_CONFIG[member.status] ?? STATUS_CONFIG.scheduled;
                            return (
                                <View key={member.user_id} style={teamStyles.member}>
                                    <View style={[teamStyles.avatarWrap, { borderColor: cfg.color }]}>
                                        <View style={[teamStyles.avatar, { backgroundColor: cfg.color + '20' }]}>
                                            <Text style={[teamStyles.avatarText, { color: cfg.color }]}>
                                                {member.initials}
                                            </Text>
                                        </View>
                                        <View style={[teamStyles.statusDot, { backgroundColor: cfg.color }]} />
                                    </View>
                                    <Text style={teamStyles.memberName} numberOfLines={1}>
                                        {member.name.split(' ')[0]}
                                    </Text>
                                    <Text style={[teamStyles.memberStatus, { color: cfg.color }]}>
                                        {cfg.label}
                                    </Text>
                                </View>
                            );
                        })}
                        {members.length < 3 && Array.from({ length: 3 - members.length }).map((_, i) => (
                            <View key={`ph-${i}`} style={teamStyles.member}>
                                <View style={[teamStyles.avatarWrap, { borderColor: '#E5E7EB' }]}>
                                    <View style={[teamStyles.avatar, { backgroundColor: '#F3F4F6' }]}>
                                        <Ionicons name="person-outline" size={18} color={colors.inputBorder} />
                                    </View>
                                </View>
                                <Text style={teamStyles.memberName}>—</Text>
                                <Text style={[teamStyles.memberStatus, { color: colors.inputBorder }]}>—</Text>
                            </View>
                        ))}
                    </View>
                    <View style={teamStyles.legend}>
                        {[
                            { color: '#10B981', label: 'Working' },
                            { color: '#F59E0B', label: 'On break' },
                            { color: '#EF4444', label: 'Late' },
                            { color: '#6366F1', label: 'Scheduled' },
                        ].map(item => (
                            <View key={item.label} style={teamStyles.legendItem}>
                                <View style={[teamStyles.legendDot, { backgroundColor: item.color }]} />
                                <Text style={teamStyles.legendLabel}>{item.label}</Text>
                            </View>
                        ))}
                    </View>
                </>
            )}
        </View>
    );
}

const teamStyles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#EFEFEF',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    title: { fontSize: 13, fontWeight: '700', color: colors.text },
    viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    viewAllText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
    emptyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
    },
    emptyText: { fontSize: 13, color: colors.gray, fontStyle: 'italic' },
    memberRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 12,
    },
    member: { alignItems: 'center', gap: 4, flex: 1 },
    avatarWrap: {
        position: 'relative',
        borderWidth: 2.5,
        borderRadius: 28,
        padding: 2,
        marginBottom: 4,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { fontSize: 16, fontWeight: '700' },
    statusDot: {
        position: 'absolute',
        bottom: 1,
        right: 1,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#fff',
    },
    memberName: { fontSize: 12, fontWeight: '600', color: colors.text, maxWidth: 70 },
    memberStatus: { fontSize: 10, fontWeight: '600' },
    legend: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F5F5F5',
        flexWrap: 'wrap',
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { fontSize: 11, color: colors.gray },
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8F8FC' },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 40 },

    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    bellBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#EFEFEF',
        position: 'relative',
    },
    bellBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: colors.error,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#F8F8FC',
    },
    bellBadgeText: { fontSize: 9, color: '#fff', fontWeight: '800' },

    statsBar: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#EFEFEF',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 18, fontWeight: '800', color: colors.text },
    statLabel: { fontSize: 10, color: colors.gray, marginTop: 2, textAlign: 'center' },
    statDivider: { width: 1, backgroundColor: '#EFEFEF', marginHorizontal: 8 },

    shiftStatusSection: { marginBottom: 16 },
    sectionLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: colors.gray,
        letterSpacing: 0.8,
        marginBottom: 8,
    },

    mainRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    shiftsCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#EFEFEF',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    shiftsCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    shiftsCardTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
    calendarBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.subtleAccent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shiftGroupLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: colors.gray,
        letterSpacing: 0.8,
        marginBottom: 6,
    },
    emptyShifts: { alignItems: 'center', paddingVertical: 16, gap: 6 },
    emptyShiftsText: { fontSize: 12, color: colors.gray, textAlign: 'center' },
});