// src/screens/admin/ScheduleScreen.tsx
import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    ActivityIndicator,
    Alert,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ShiftsAPI } from '../../api/api';
import { AuthContext } from '../../context/AuthContext';
import { useQuery } from '@apollo/client/react';
import { MY_LOCATIONS_QUERY } from '../../graphql/operations';

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

type LaborCost = {
    total_shifts: number;
    total_hours:  number;
    total_cost:   number;
    hourly_rate:  number;
};

type Location = { id: number; name: string };
type MyLocationsData = { myLocations: Location[] };

// ── Date helpers ──────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
    const d   = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

function formatDayLabel(date: Date): string {
    return date.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDayShort(date: Date): string {
    return date.toLocaleDateString('en-CA', { weekday: 'short' }).toUpperCase();
}

function formatDayNum(date: Date): string {
    return date.getDate().toString();
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatWeekRange(start: Date): string {
    const end = addDays(start, 6);
    const s = start.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
    const e = end.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${s} – ${e}`;
}

function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth()    === b.getMonth()    &&
        a.getDate()     === b.getDate()
    );
}

function isToday(date: Date): boolean {
    return isSameDay(date, new Date());
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScheduleScreen({ navigation }: any) {
    const { user } = useContext(AuthContext);

    const [weekStart, setWeekStart]         = useState<Date>(() => getWeekStart(new Date()));
    const [shifts, setShifts]               = useState<ShiftDetail[]>([]);
    const [laborCost, setLaborCost]         = useState<LaborCost | null>(null);
    const [loading, setLoading]             = useState(false);
    const [refreshing, setRefreshing]       = useState(false);
    const [publishing, setPublishing]       = useState(false);
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
    const [showLocationPicker, setShowLocationPicker] = useState(false);

    // ── Locations ─────────────────────────────────────────────────────────────
    const { data: locData } = useQuery<MyLocationsData>(MY_LOCATIONS_QUERY, {
        fetchPolicy: 'cache-and-network',
    });
    const locations = locData?.myLocations ?? [];

    useEffect(() => {
        if (locations.length && !selectedLocationId) {
            const preferred = user?.primaryLocation?.id
                ? locations.find(l => l.id === user?.primaryLocation?.id)
                : null;
            setSelectedLocationId(preferred?.id ?? locations[0]?.id ?? null);
        }
    }, [locations, user]);

    // ── Fetch shifts ──────────────────────────────────────────────────────────
    const fetchData = useCallback(async (loc: number, ws: Date) => {
        setLoading(true);
        try {
            const weekStr = formatDate(ws);
            const [shiftsRes, costRes] = await Promise.all([
                ShiftsAPI.list(loc, weekStr),
                ShiftsAPI.laborCost(loc, weekStr),
            ]);
            setShifts(shiftsRes.data?.shifts ?? []);
            setLaborCost(costRes.data ?? null);
        } catch (e) {
            console.warn('[ScheduleScreen] fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedLocationId) {
            fetchData(selectedLocationId, weekStart);
        }
    }, [selectedLocationId, weekStart, fetchData]);

    const onRefresh = useCallback(async () => {
        if (!selectedLocationId) return;
        setRefreshing(true);
        await fetchData(selectedLocationId, weekStart);
        setRefreshing(false);
    }, [selectedLocationId, weekStart, fetchData]);

    // ── Week navigation ───────────────────────────────────────────────────────
    const prevWeek = () => setWeekStart(w => addDays(w, -7));
    const nextWeek = () => setWeekStart(w => addDays(w, 7));
    const goToday  = () => setWeekStart(getWeekStart(new Date()));

    // ── Week days ─────────────────────────────────────────────────────────────
    const weekDays = useMemo(() => (
        Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    ), [weekStart]);

    // ── Shifts grouped by day ─────────────────────────────────────────────────
    const shiftsByDay = useMemo(() => {
        const map = new Map<string, ShiftDetail[]>();
        weekDays.forEach(d => map.set(formatDate(d), []));
        shifts.forEach(s => {
            const key = formatDate(new Date(s.start_time));
            if (map.has(key)) map.get(key)!.push(s);
        });
        return map;
    }, [shifts, weekDays]);

    // ── Draft count ───────────────────────────────────────────────────────────
    const draftCount = useMemo(
        () => shifts.filter(s => s.status === 'draft').length,
        [shifts],
    );

    // ── Publish ───────────────────────────────────────────────────────────────
    const handlePublish = async () => {
        if (!selectedLocationId || draftCount === 0) return;
        Alert.alert(
            'Publish Schedule',
            `Publish ${draftCount} draft shift${draftCount > 1 ? 's' : ''}? Staff will be notified immediately.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Publish',
                    style: 'default',
                    onPress: async () => {
                        setPublishing(true);
                        try {
                            await ShiftsAPI.publish(selectedLocationId, formatDate(weekStart));
                            await fetchData(selectedLocationId, weekStart);
                            Alert.alert('Published!', `${draftCount} shifts are now live.`);
                        } catch (e: any) {
                            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to publish');
                        } finally {
                            setPublishing(false);
                        }
                    },
                },
            ]
        );
    };

    // ── Selected location name ────────────────────────────────────────────────
    const locationName = useMemo(
        () => locations.find(l => l.id === selectedLocationId)?.name ?? 'Select location',
        [locations, selectedLocationId],
    );

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>

            {/* ── Top bar ── */}
            <View style={styles.topBar}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.screenTitle}>Schedule</Text>
                <Pressable onPress={goToday} style={styles.todayBtn}>
                    <Text style={styles.todayBtnText}>Today</Text>
                </Pressable>
            </View>

            {/* ── Location picker ── */}
            <Pressable
                style={styles.locationBar}
                onPress={() => setShowLocationPicker(p => !p)}
            >
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <Text style={styles.locationName}>{locationName}</Text>
                <Ionicons
                    name={showLocationPicker ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.gray}
                />
            </Pressable>

            {showLocationPicker && (
                <View style={styles.locationDropdown}>
                    {locations.map(loc => (
                        <Pressable
                            key={loc.id}
                            style={[
                                styles.locationOption,
                                loc.id === selectedLocationId && styles.locationOptionActive,
                            ]}
                            onPress={() => {
                                setSelectedLocationId(loc.id);
                                setShowLocationPicker(false);
                            }}
                        >
                            <Text style={[
                                styles.locationOptionText,
                                loc.id === selectedLocationId && { color: colors.primary, fontWeight: '700' },
                            ]}>
                                {loc.name}
                            </Text>
                            {loc.id === selectedLocationId && (
                                <Ionicons name="checkmark" size={16} color={colors.primary} />
                            )}
                        </Pressable>
                    ))}
                </View>
            )}

            {/* ── Week navigation ── */}
            <View style={styles.weekNav}>
                <Pressable onPress={prevWeek} style={styles.weekNavBtn}>
                    <Ionicons name="chevron-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.weekLabel}>{formatWeekRange(weekStart)}</Text>
                <Pressable onPress={nextWeek} style={styles.weekNavBtn}>
                    <Ionicons name="chevron-forward" size={22} color={colors.text} />
                </Pressable>
            </View>

            {/* ── Labor cost banner ── */}
            {laborCost && laborCost.total_shifts > 0 && (
                <View style={styles.laborBanner}>
                    <View style={styles.laborItem}>
                        <Text style={styles.laborValue}>{laborCost.total_shifts}</Text>
                        <Text style={styles.laborLabel}>shifts</Text>
                    </View>
                    <View style={styles.laborDivider} />
                    <View style={styles.laborItem}>
                        <Text style={styles.laborValue}>{laborCost.total_hours}h</Text>
                        <Text style={styles.laborLabel}>hours</Text>
                    </View>
                    <View style={styles.laborDivider} />
                    <View style={styles.laborItem}>
                        <Text style={styles.laborValue}>${laborCost.total_cost}</Text>
                        <Text style={styles.laborLabel}>est. cost</Text>
                    </View>
                    {draftCount > 0 && (
                        <>
                            <View style={styles.laborDivider} />
                            <View style={styles.laborItem}>
                                <Text style={[styles.laborValue, { color: colors.warning }]}>
                                    {draftCount}
                                </Text>
                                <Text style={styles.laborLabel}>drafts</Text>
                            </View>
                        </>
                    )}
                </View>
            )}

            {/* ── Day columns ── */}
            {loading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading shifts...</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    {weekDays.map(day => {
                        const key       = formatDate(day);
                        const dayShifts = shiftsByDay.get(key) ?? [];
                        const today     = isToday(day);

                        return (
                            <View key={key} style={styles.dayBlock}>
                                {/* Day header */}
                                <View style={styles.dayHeader}>
                                    <View style={[
                                        styles.dayBadge,
                                        today && styles.dayBadgeToday,
                                    ]}>
                                        <Text style={[
                                            styles.dayShort,
                                            today && styles.dayShortToday,
                                        ]}>
                                            {formatDayShort(day)}
                                        </Text>
                                        <Text style={[
                                            styles.dayNum,
                                            today && styles.dayNumToday,
                                        ]}>
                                            {formatDayNum(day)}
                                        </Text>
                                    </View>
                                    <Text style={styles.shiftCount}>
                                        {dayShifts.length > 0
                                            ? `${dayShifts.length} shift${dayShifts.length > 1 ? 's' : ''}`
                                            : 'No shifts'}
                                    </Text>

                                    {/* Add shift button */}
                                    <Pressable
                                        style={styles.addShiftBtn}
                                        onPress={() => navigation.navigate('CreateShift', {
                                            locationId: selectedLocationId,
                                            date:       key,
                                        })}
                                    >
                                        <Ionicons name="add" size={18} color={colors.primary} />
                                    </Pressable>
                                </View>

                                {/* Shift cards */}
                                {dayShifts.length > 0 ? (
                                    dayShifts.map(shift => (
                                        <ShiftCard
                                            key={shift.shift_id}
                                            shift={shift}
                                            onPress={() => navigation.navigate('ShiftDetail', {
                                                shiftId:    shift.shift_id,
                                                locationId: selectedLocationId,
                                            })}
                                        />
                                    ))
                                ) : (
                                    <Pressable
                                        style={styles.emptyDay}
                                        onPress={() => navigation.navigate('CreateShift', {
                                            locationId: selectedLocationId,
                                            date:       key,
                                        })}
                                    >
                                        <Ionicons name="add-circle-outline" size={18} color={colors.gray} />
                                        <Text style={styles.emptyDayText}>Add a shift</Text>
                                    </Pressable>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            {/* ── Bottom action bar ── */}
            <View style={styles.bottomBar}>
                <Pressable
                    style={styles.createBtn}
                    onPress={() => navigation.navigate('CreateShift', {
                        locationId: selectedLocationId,
                        date:       formatDate(new Date()),
                    })}
                >
                    <Ionicons name="add" size={20} color={colors.primary} />
                    <Text style={styles.createBtnText}>Create Shift</Text>
                </Pressable>

                {draftCount > 0 && (
                    <Pressable
                        style={[styles.publishBtn, publishing && { opacity: 0.6 }]}
                        onPress={handlePublish}
                        disabled={publishing}
                    >
                        {publishing ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                                <Text style={styles.publishBtnText}>
                                    Publish {draftCount} Draft{draftCount > 1 ? 's' : ''}
                                </Text>
                            </>
                        )}
                    </Pressable>
                )}
            </View>
        </SafeAreaView>
    );
}

// ── ShiftCard component ───────────────────────────────────────────────────────

function ShiftCard({ shift, onPress }: { shift: ShiftDetail; onPress: () => void }) {
    const isDraft     = shift.status === 'draft';
    const isPublished = shift.status === 'published';
    const isCancelled = shift.status === 'cancelled';

    const statusColor = isDraft
        ? colors.warning
        : isPublished
        ? colors.success
        : colors.gray;

    const statusLabel = isDraft ? 'DRAFT' : isPublished ? 'LIVE' : 'CANCELLED';

    return (
        <Pressable
            style={({ pressed }) => [
                styles.shiftCard,
                { borderLeftColor: statusColor },
                pressed && { opacity: 0.85 },
                isCancelled && { opacity: 0.5 },
            ]}
            onPress={onPress}
        >
            <View style={styles.shiftCardTop}>
                <Text style={styles.shiftTime}>
                    {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    {shift.created_by_ai && (
                        <Ionicons name="sparkles" size={11} color={statusColor} />
                    )}
                    <Text style={[styles.statusText, { color: statusColor }]}>
                        {statusLabel}
                    </Text>
                </View>
            </View>

            <View style={styles.shiftCardBottom}>
                {shift.role && (
                    <View style={styles.shiftMeta}>
                        <Ionicons name="briefcase-outline" size={13} color={colors.gray} />
                        <Text style={styles.shiftMetaText}>{shift.role}</Text>
                    </View>
                )}
                <View style={styles.shiftMeta}>
                    <Ionicons name="people-outline" size={13} color={colors.gray} />
                    <Text style={styles.shiftMetaText}>
                        {shift.assignments.length} assigned
                    </Text>
                </View>
                {shift.break_minutes > 0 && (
                    <View style={styles.shiftMeta}>
                        <Ionicons name="cafe-outline" size={13} color={colors.gray} />
                        <Text style={styles.shiftMetaText}>{shift.break_minutes}m break</Text>
                    </View>
                )}
            </View>

            {shift.notes ? (
                <Text style={styles.shiftNotes} numberOfLines={1}>{shift.notes}</Text>
            ) : null}
        </Pressable>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    // Top bar
    topBar: {
        flexDirection:  'row',
        alignItems:     'center',
        paddingHorizontal: 16,
        paddingVertical:   12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backBtn:      { padding: 4, marginRight: 8 },
    screenTitle:  { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
    todayBtn:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.primary },
    todayBtnText: { fontSize: 12, color: colors.primary, fontWeight: '600' },

    // Location
    locationBar: {
        flexDirection:    'row',
        alignItems:       'center',
        gap:              6,
        paddingHorizontal: 16,
        paddingVertical:  10,
        backgroundColor:  colors.subtleAccent,
        borderBottomWidth: 1,
        borderBottomColor: '#E8E8F0',
    },
    locationName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
    locationDropdown: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 4,
    },
    locationOption: {
        flexDirection:    'row',
        alignItems:       'center',
        justifyContent:   'space-between',
        paddingHorizontal: 20,
        paddingVertical:  12,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    locationOptionActive: { backgroundColor: colors.subtleAccent },
    locationOptionText:   { fontSize: 14, color: colors.text },

    // Week nav
    weekNav: {
        flexDirection:  'row',
        alignItems:     'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingVertical:   10,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    weekNavBtn:  { padding: 8 },
    weekLabel:   { fontSize: 14, fontWeight: '700', color: colors.text },

    // Labor banner
    laborBanner: {
        flexDirection:  'row',
        alignItems:     'center',
        justifyContent: 'space-around',
        backgroundColor: colors.subtleCard,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#EFEFEF',
    },
    laborItem:    { alignItems: 'center' },
    laborValue:   { fontSize: 15, fontWeight: '800', color: colors.text },
    laborLabel:   { fontSize: 11, color: colors.gray, marginTop: 1 },
    laborDivider: { width: 1, height: 28, backgroundColor: '#E0E0E0' },

    // Scroll
    scroll:           { flex: 1 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText:      { fontSize: 13, color: colors.gray },

    // Day block
    dayBlock: {
        marginHorizontal: 16,
        marginTop:        16,
        borderRadius:     12,
        overflow:         'hidden',
        borderWidth:      1,
        borderColor:      '#F0F0F0',
        backgroundColor:  '#FAFAFA',
    },
    dayHeader: {
        flexDirection:  'row',
        alignItems:     'center',
        paddingHorizontal: 12,
        paddingVertical:   10,
        backgroundColor:   '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        gap: 8,
    },
    dayBadge: {
        alignItems:      'center',
        width:           40,
        paddingVertical: 4,
        borderRadius:    8,
        backgroundColor: '#F3F4F6',
    },
    dayBadgeToday:  { backgroundColor: colors.primary },
    dayShort:       { fontSize: 10, fontWeight: '700', color: colors.gray },
    dayShortToday:  { color: '#fff' },
    dayNum:         { fontSize: 16, fontWeight: '800', color: colors.text },
    dayNumToday:    { color: '#fff' },
    shiftCount:     { flex: 1, fontSize: 12, color: colors.gray },
    addShiftBtn:    {
        width:          32,
        height:         32,
        borderRadius:   16,
        backgroundColor: colors.subtleAccent,
        alignItems:     'center',
        justifyContent: 'center',
    },

    // Empty day
    emptyDay: {
        flexDirection:  'row',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            6,
        paddingVertical: 16,
    },
    emptyDayText: { fontSize: 13, color: colors.gray },

    // Shift card
    shiftCard: {
        margin:          10,
        padding:         12,
        borderRadius:    10,
        backgroundColor: '#fff',
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
        shadowColor:     '#000',
        shadowOpacity:   0.04,
        shadowRadius:    4,
        elevation:       1,
    },
    shiftCardTop: {
        flexDirection:  'row',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   6,
    },
    shiftTime:    { fontSize: 14, fontWeight: '700', color: colors.text },
    statusBadge:  {
        flexDirection:  'row',
        alignItems:     'center',
        gap:            4,
        paddingHorizontal: 8,
        paddingVertical:   3,
        borderRadius:   999,
    },
    statusText:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    shiftCardBottom: {
        flexDirection: 'row',
        flexWrap:      'wrap',
        gap:           10,
    },
    shiftMeta: {
        flexDirection: 'row',
        alignItems:    'center',
        gap:           4,
    },
    shiftMetaText: { fontSize: 12, color: colors.gray },
    shiftNotes:    {
        marginTop:  6,
        fontSize:   12,
        color:      colors.gray,
        fontStyle:  'italic',
    },

    // Bottom bar
    bottomBar: {
        position:        'absolute',
        bottom:          0,
        left:            0,
        right:           0,
        flexDirection:   'row',
        gap:             10,
        paddingHorizontal: 16,
        paddingVertical:   12,
        paddingBottom:   24,
        backgroundColor: '#fff',
        borderTopWidth:  1,
        borderTopColor:  '#F0F0F0',
        shadowColor:     '#000',
        shadowOpacity:   0.06,
        shadowRadius:    8,
        elevation:       8,
    },
    createBtn: {
        flex:           1,
        flexDirection:  'row',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            6,
        paddingVertical: 12,
        borderRadius:   999,
        borderWidth:    1.5,
        borderColor:    colors.primary,
        backgroundColor: '#fff',
    },
    createBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
    publishBtn: {
        flex:           1,
        flexDirection:  'row',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            6,
        paddingVertical: 12,
        borderRadius:   999,
        backgroundColor: colors.success,
    },
    publishBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});