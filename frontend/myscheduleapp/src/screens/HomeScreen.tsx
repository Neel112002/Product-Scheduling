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
    Modal,
    FlatList,
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
import { ShiftsAPI, TimeEntryAPI, AdminAPI } from '../api/api';
import { useNotifications } from '../hooks/useNotifications';
import { MY_LOCATIONS_QUERY } from '../graphql/operations';

import PulsingDot from '../components/home/PulsingDot';
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

function getMonday(offsetWeeks = 0): string {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1) + offsetWeeks * 7);
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

function isFutureOrTodayShift(iso: string): boolean {
    const d = new Date(iso);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return d >= now;
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
    const { user: authUser } = useContext(AuthContext);
    const { notifications, unreadCount } = useNotifications();

    const [myShifts, setMyShifts] = useState<ShiftDetail[]>([]);
    const [activeEntry, setActiveEntry] = useState<ActiveEntry | null>(null);
    const [todayShift, setTodayShift] = useState<TodayShift | null>(null);
    const [clockSettings, setClockSettings] = useState<ClockSettings | null>(null);
    const [teamStatus, setTeamStatus] = useState<TeamMemberStatus[]>([]);
    const [loadingShifts, setLoadingShifts] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [locations, setLocations] = useState<LocationOption[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
        authUser?.primaryLocation?.id ?? null,
    );
    const [showLocationPicker, setShowLocationPicker] = useState(false);

    // ── Locations — REST primary, GraphQL as supplement ───────────────────────
    const fetchLocations = useCallback(async () => {
        try {
            const { data } = await AdminAPI.listLocations();
            const locs: LocationOption[] = (data?.locations ?? []).map((l: any) => ({
                id: l.id,
                name: l.name,
            }));
            if (locs.length) setLocations(locs);
        } catch {
            // silently ignore — GraphQL fallback below
        }
    }, []);

    useEffect(() => { fetchLocations(); }, [fetchLocations]);

    // GraphQL supplement
    const { data: gqlLocData } = useQuery<MyLocationsData>(MY_LOCATIONS_QUERY, {
        fetchPolicy: 'cache-and-network',
    });

    useEffect(() => {
        if (gqlLocData?.myLocations?.length) {
            setLocations(gqlLocData.myLocations);
        }
    }, [gqlLocData]);

    // Set selectedLocationId as soon as any location source resolves
    useEffect(() => {
        if (selectedLocationId) return;
        const fromAuth = authUser?.primaryLocation?.id;
        if (fromAuth) {
            setSelectedLocationId(fromAuth);
            return;
        }
        if (locations.length) {
            setSelectedLocationId(locations[0].id);
        }
    }, [authUser, locations, selectedLocationId]);

    // ── My shifts (this week + next week) ─────────────────────────────────────
    const fetchMyShifts = useCallback(async () => {
        setLoadingShifts(true);
        try {
            const [thisWeek, nextWeek] = await Promise.all([
                ShiftsAPI.mine(getMonday(0)),
                ShiftsAPI.mine(getMonday(1)),
            ]);
            const combined = [
                ...(thisWeek.data?.shifts ?? []),
                ...(nextWeek.data?.shifts ?? []),
            ];
            const seen = new Set<number>();
            const unique = combined.filter(s => {
                if (seen.has(s.shift_id)) return false;
                seen.add(s.shift_id);
                return true;
            });
            setMyShifts(unique);
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

    useEffect(() => {
        const interval = setInterval(fetchActiveEntry, 60_000);
        return () => clearInterval(interval);
    }, [fetchActiveEntry]);

    // ── Team status — all employees with a shift today ────────────────────────
    const fetchTeamStatus = useCallback(async () => {
        if (!selectedLocationId) return;
        try {
            const { data } = await TimeEntryAPI.getTeamStatus(selectedLocationId);
            const order: Record<string, number> = {
                late: 0, working: 1, on_break: 2, scheduled: 3,
            };
            const sorted = (data?.team ?? []).sort(
                (a: TeamMemberStatus, b: TeamMemberStatus) =>
                    (order[a.status] ?? 4) - (order[b.status] ?? 4)
            );
            setTeamStatus(sorted);
        } catch {
            setTeamStatus([]);
        }
    }, [selectedLocationId]);

    useEffect(() => { fetchTeamStatus(); }, [fetchTeamStatus]);

    useEffect(() => {
        const interval = setInterval(fetchTeamStatus, 30_000);
        return () => clearInterval(interval);
    }, [fetchTeamStatus]);

    // ── Refresh ───────────────────────────────────────────────────────────────
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([
            fetchLocations(),
            fetchMyShifts(),
            fetchActiveEntry(),
            fetchTeamStatus(),
        ]);
        setRefreshing(false);
    }, [fetchLocations, fetchMyShifts, fetchActiveEntry, fetchTeamStatus]);

    // ── Derived ───────────────────────────────────────────────────────────────
    const sortedShifts = useMemo(() =>
        [...myShifts].sort(
            (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        ), [myShifts]);

    const upcomingShifts = useMemo(
        () => sortedShifts.filter(s =>
            !isTodayShift(s.start_time) && isFutureOrTodayShift(s.start_time)
        ),
        [sortedShifts]
    );

    const thisWeekShifts = useMemo(() => {
        const monday = new Date(getMonday(0));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return myShifts.filter(s => {
            const d = new Date(s.start_time);
            return d >= monday && d <= sunday;
        });
    }, [myShifts]);

    const hoursThisWeek = useMemo(() => {
        const total = thisWeekShifts.reduce((acc, s) => {
            const diff = new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
            return acc + (diff / 3600000) - (s.break_minutes / 60);
        }, 0);
        return Math.round(total * 10) / 10;
    }, [thisWeekShifts]);

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
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <HeaderGreeting
                            name={displayName}
                            initials={initials}
                        />
                    </View>
                    <Pressable
                        style={styles.locationPill}
                        onPress={() => setShowLocationPicker(true)}
                    >
                        <Ionicons name="location-outline" size={14} color={colors.primary} />
                        <Text style={styles.locationPillText} numberOfLines={1}>
                            {locationName}
                        </Text>
                        <Ionicons name="chevron-down" size={14} color={colors.gray} />
                    </Pressable>
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
                        <Text style={styles.statValue}>{thisWeekShifts.length}</Text>
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

                {/* Today's shift status card */}
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
                            <View style={styles.shiftsCardActions}>
                                {upcomingShifts.length > 0 && (
                                    <View style={styles.shiftCountBadge}>
                                        <Text style={styles.shiftCountText}>
                                            {upcomingShifts.length}
                                        </Text>
                                    </View>
                                )}
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
                        </View>

                        {upcomingShifts.length > 0 ? (
                            <>
                                <Text style={styles.shiftGroupLabel}>UPCOMING</Text>
                                <ScrollView
                                    style={styles.shiftsScroll}
                                    showsVerticalScrollIndicator={false}
                                    nestedScrollEnabled={true}
                                >
                                    {upcomingShifts.map(s => (
                                        <ShiftRow key={s.shift_id} shift={s} />
                                    ))}
                                </ScrollView>
                            </>
                        ) : (
                            <View style={styles.emptyShifts}>
                                <Ionicons name="calendar-outline" size={24} color={colors.inputBorder} />
                                <Text style={styles.emptyShiftsText}>No upcoming shifts</Text>
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

            {/* Location picker — moved here from HeaderGreeting so it can sit beside the bell */}
            <Modal
                visible={showLocationPicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowLocationPicker(false)}
            >
                <Pressable style={styles.locationBackdrop} onPress={() => setShowLocationPicker(false)}>
                    <View />
                </Pressable>
                <View style={styles.locationSheet}>
                    <View style={styles.locationSheetHeader}>
                        <Text style={styles.locationSheetTitle}>Select location</Text>
                        <Pressable onPress={() => setShowLocationPicker(false)} hitSlop={8}>
                            <Ionicons name="close" size={20} color={colors.gray} />
                        </Pressable>
                    </View>
                    <FlatList
                        data={locationNames.length ? locationNames : [locationName]}
                        keyExtractor={(item) => item}
                        ItemSeparatorComponent={() => <View style={styles.locationSep} />}
                        renderItem={({ item }) => {
                            const active = item === locationName;
                            return (
                                <Pressable
                                    onPress={() => {
                                        const loc = locations.find(l => l.name === item);
                                        if (loc) setSelectedLocationId(loc.id);
                                        setShowLocationPicker(false);
                                    }}
                                    style={({ pressed }) => [
                                        styles.locationRow,
                                        pressed && { backgroundColor: '#F7F7F7' },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.locationRowText,
                                            active && { color: colors.primary, fontWeight: '700' },
                                        ]}
                                    >
                                        {item}
                                    </Text>
                                    {active && (
                                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                                    )}
                                </Pressable>
                            );
                        }}
                    />
                </View>
            </Modal>
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
    const previewMembers = members.slice(0, 4);

    return (
        <View style={teamStyles.card}>
            <View style={teamStyles.cardHeader}>
                <View style={teamStyles.titleRow}>
                    <Text style={teamStyles.title}>Today's Team</Text>
                    {members.length > 0 && (
                        <View style={teamStyles.countBadge}>
                            <Text style={teamStyles.countBadgeText}>{members.length}</Text>
                        </View>
                    )}
                </View>
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
                    <Text style={teamStyles.emptyText}>No shifts scheduled today</Text>
                </View>
            ) : (
                <>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={teamStyles.memberRow}
                    >
                        {previewMembers.map(member => {
                            const cfg = STATUS_CONFIG[member.status] ?? STATUS_CONFIG.scheduled;
                            return (
                                <View key={member.user_id} style={teamStyles.member}>
                                    <View style={[teamStyles.avatarWrap, { borderColor: cfg.color }]}>
                                        <View style={[teamStyles.avatar, { backgroundColor: cfg.color + '20' }]}>
                                            <Text style={[teamStyles.avatarText, { color: cfg.color }]}>
                                                {member.initials}
                                            </Text>
                                        </View>
                                        <View style={teamStyles.statusDotWrap}>
                                            <PulsingDot
                                                color={cfg.color}
                                                size={12}
                                                active={member.status === 'working'}
                                            />
                                        </View>
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
                        {members.length > 4 && (
                            <Pressable style={teamStyles.member} onPress={onViewAll}>
                                <View style={[teamStyles.avatarWrap, { borderColor: colors.inputBorder }]}>
                                    <View style={[teamStyles.avatar, { backgroundColor: '#F3F4F6' }]}>
                                        <Text style={teamStyles.moreText}>+{members.length - 4}</Text>
                                    </View>
                                </View>
                                <Text style={teamStyles.memberName}>More</Text>
                                <Text style={[teamStyles.memberStatus, { color: colors.gray }]}>View all</Text>
                            </Pressable>
                        )}
                    </ScrollView>
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
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { fontSize: 13, fontWeight: '700', color: colors.text },
    countBadge: {
        backgroundColor: colors.primary + '18',
        borderRadius: 999,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    countBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
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
    memberRow: { flexDirection: 'row', gap: 12, paddingBottom: 4 },
    member: { alignItems: 'center', gap: 4, minWidth: 60 },
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
    moreText: { fontSize: 13, fontWeight: '700', color: colors.gray },
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
    statusDotWrap: {
        position: 'absolute',
        bottom: 1,
        right: 1,
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
        alignItems: 'center',
        marginBottom: 16,
    },
    locationPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        maxWidth: 130,
        paddingHorizontal: 9,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#EFEFEF',
    },
    locationPillText: {
        fontSize: 12,
        color: colors.text,
        fontWeight: '600',
        flexShrink: 1,
    },
    bellBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
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

    locationBackdrop: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.15)',
    },
    locationSheet: {
        position: 'absolute',
        left: 16,
        right: 16,
        top: 110,
        borderRadius: 14,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: '#00000010',
        padding: 10,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    locationSheetHeader: {
        paddingHorizontal: 4,
        paddingVertical: 6,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    locationSheetTitle: { color: colors.text, fontWeight: '700' },
    locationSep: { height: 1, backgroundColor: colors.inputBorder, opacity: 0.7 },
    locationRow: {
        paddingVertical: 10,
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    locationRowText: { color: colors.text, fontSize: 14 },

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

    mainRow: { flexDirection: 'row', gap: 12, marginBottom: 16, alignItems: 'stretch' },
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
    shiftsScroll: { flex: 1 },
    shiftsCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    shiftsCardTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
    shiftsCardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    shiftCountBadge: {
        backgroundColor: colors.primary,
        borderRadius: 999,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    shiftCountText: { fontSize: 10, fontWeight: '800', color: '#fff' },
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