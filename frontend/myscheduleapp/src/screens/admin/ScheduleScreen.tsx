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
    shift_id: number;
    location_id: number;
    role?: string | null;
    start_time: string;
    end_time: string;
    break_minutes: number;
    notes?: string | null;
    status: 'draft' | 'published' | 'cancelled';
    created_by_ai: boolean;
    published_at?: string | null;
    assignments: { user_id: number; assigned_at: string }[];
};

type LaborCost = {
    total_shifts: number;
    total_hours: number;
    total_cost: number;
    hourly_rate: number;
};

type Location = { id: number; name: string };
type MyLocationsData = { myLocations: Location[] };

// ── Date helpers ──────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    d.setHours(0, 0, 0, 0);
    return d;
}

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function formatDayShort(date: Date): string {
    return date.toLocaleDateString('en-CA', { weekday: 'short' }).toUpperCase();
}

function formatDayNum(date: Date): string {
    return date.getDate().toString();
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-CA', {
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
}

function formatWeekRange(start: Date): string {
    const end = addDays(start, 6);
    const s = start.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
    const e = end.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${s} – ${e}`;
}

function isToday(date: Date): boolean {
    const today = new Date();
    return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
    );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScheduleScreen({ navigation, route }: any) {
    const { user } = useContext(AuthContext);

    // ✅ Read-only mode when opened from employee home screen
    const readOnly = route?.params?.readOnly ?? false;
    const isManager = ['owner', 'manager', 'supervisor'].includes(
        (user?.role?.name ?? '').toLowerCase()
    );
    const canEdit = isManager && !readOnly;

    const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
    const [shifts, setShifts] = useState<ShiftDetail[]>([]);
    const [laborCost, setLaborCost] = useState<LaborCost | null>(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
        route?.params?.locationId ?? null
    );
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
                canEdit ? ShiftsAPI.laborCost(loc, weekStr) : Promise.resolve({ data: null }),
            ]);
            setShifts(shiftsRes.data?.shifts ?? []);
            setLaborCost(costRes.data ?? null);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [canEdit]);

    useEffect(() => {
        if (selectedLocationId) fetchData(selectedLocationId, weekStart);
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
    const goToday = () => setWeekStart(getWeekStart(new Date()));

    // ── Week days ─────────────────────────────────────────────────────────────
    const weekDays = useMemo(
        () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
        [weekStart]
    );

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

    // ── Draft count (managers only) ───────────────────────────────────────────
    const draftCount = useMemo(
        () => canEdit ? shifts.filter(s => s.status === 'draft').length : 0,
        [shifts, canEdit]
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

    const locationName = useMemo(
        () => locations.find(l => l.id === selectedLocationId)?.name ?? 'Select location',
        [locations, selectedLocationId]
    );

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>

            {/* Top bar */}
            <View style={styles.topBar}>
                {navigation.canGoBack() && (
                    <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color={colors.text} />
                    </Pressable>
                )}
                <Text style={styles.screenTitle}>
                    {canEdit ? 'Schedule' : 'My Schedule'}
                </Text>
                {canEdit ? (
                    <Pressable
                        onPress={() => navigation.navigate('WeekSchedule', {
                            locationId: selectedLocationId,
                        })}
                        style={styles.bulkBtn}
                    >
                        <Ionicons name="grid-outline" size={14} color="#fff" />
                        <Text style={styles.bulkBtnText}>Bulk</Text>
                    </Pressable>
                ) : (
                    <Pressable onPress={goToday} style={styles.todayBtn}>
                        <Text style={styles.todayBtnText}>Today</Text>
                    </Pressable>
                )}
            </View>

            {/* Location picker */}
            <Pressable
                style={styles.locationBar}
                onPress={() => setShowLocationPicker(p => !p)}
            >
                <Ionicons name="location-outline" size={15} color={colors.primary} />
                <Text style={styles.locationName}>{locationName}</Text>
                <Ionicons
                    name={showLocationPicker ? 'chevron-up' : 'chevron-down'}
                    size={15}
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
                                loc.id === selectedLocationId && {
                                    color: colors.primary, fontWeight: '700',
                                },
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

            {/* Week navigation */}
            <View style={styles.weekNav}>
                <Pressable onPress={prevWeek} style={styles.weekNavBtn}>
                    <Ionicons name="chevron-back" size={20} color={colors.text} />
                </Pressable>
                <Text style={styles.weekLabel}>{formatWeekRange(weekStart)}</Text>
                <Pressable onPress={nextWeek} style={styles.weekNavBtn}>
                    <Ionicons name="chevron-forward" size={20} color={colors.text} />
                </Pressable>
            </View>

            {/* ✅ Labor cost banner — managers only */}
            {canEdit && laborCost && laborCost.total_shifts > 0 && (
                <View style={styles.laborBanner}>
                    <LaborItem value={String(laborCost.total_shifts)} label="shifts" />
                    <View style={styles.laborDivider} />
                    <LaborItem value={`${laborCost.total_hours}h`} label="hours" />
                    <View style={styles.laborDivider} />
                    <LaborItem value={`$${laborCost.total_cost}`} label="est. cost" />
                    {draftCount > 0 && (
                        <>
                            <View style={styles.laborDivider} />
                            <LaborItem
                                value={String(draftCount)}
                                label="drafts"
                                valueColor={colors.warning}
                            />
                        </>
                    )}
                </View>
            )}

            {/* Day list */}
            {loading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading shifts...</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={{ paddingBottom: canEdit ? 120 : 32 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    {weekDays.map(day => {
                        const key = formatDate(day);
                        const dayShifts = shiftsByDay.get(key) ?? [];
                        const today = isToday(day);
                        const hasShifts = dayShifts.length > 0;

                        return (
                            <View key={key} style={styles.dayBlock}>
                                {/* Day header */}
                                <View style={styles.dayHeader}>
                                    <View style={[
                                        styles.dayBadge,
                                        today && styles.dayBadgeToday,
                                    ]}>
                                        <Text style={[styles.dayShort, today && styles.dayShortToday]}>
                                            {formatDayShort(day)}
                                        </Text>
                                        <Text style={[styles.dayNum, today && styles.dayNumToday]}>
                                            {formatDayNum(day)}
                                        </Text>
                                    </View>

                                    <Text style={styles.shiftCount}>
                                        {hasShifts
                                            ? `${dayShifts.length} shift${dayShifts.length > 1 ? 's' : ''}`
                                            : 'No shifts'}
                                    </Text>

                                    {/* ✅ + button — managers only */}
                                    {canEdit && (
                                        <Pressable
                                            style={styles.addShiftBtn}
                                            onPress={() => navigation.navigate('CreateShift', {
                                                locationId: selectedLocationId,
                                                date: key,
                                            })}
                                        >
                                            <Ionicons name="add" size={18} color={colors.primary} />
                                        </Pressable>
                                    )}
                                </View>

                                {/* Shift cards */}
                                {dayShifts.map(shift => (
                                    <ShiftCard
                                        key={shift.shift_id}
                                        shift={shift}
                                        canEdit={canEdit}
                                        onPress={() => canEdit
                                            ? navigation.navigate('ShiftDetail', {
                                                shiftId: shift.shift_id,
                                                locationId: selectedLocationId,
                                            })
                                            : undefined
                                        }
                                    />
                                ))}
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            {/* ✅ Bottom action bar — managers only */}
            {canEdit && (
                <View style={styles.bottomBar}>
                    <Pressable
                        style={styles.createBtn}
                        onPress={() => navigation.navigate('CreateShift', {
                            locationId: selectedLocationId,
                            date: formatDate(new Date()),
                        })}
                    >
                        <Ionicons name="add" size={18} color={colors.primary} />
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
                                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                                    <Text style={styles.publishBtnText}>
                                        Publish {draftCount} Draft{draftCount > 1 ? 's' : ''}
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    )}
                </View>
            )}
        </SafeAreaView>
    );
}

// ── LaborItem ─────────────────────────────────────────────────────────────────

function LaborItem({ value, label, valueColor }: {
    value: string; label: string; valueColor?: string;
}) {
    return (
        <View style={laborStyles.item}>
            <Text style={[laborStyles.value, valueColor ? { color: valueColor } : {}]}>
                {value}
            </Text>
            <Text style={laborStyles.label}>{label}</Text>
        </View>
    );
}

const laborStyles = StyleSheet.create({
    item: { alignItems: 'center' },
    value: { fontSize: 15, fontWeight: '800', color: colors.text },
    label: { fontSize: 11, color: colors.gray, marginTop: 1 },
});

// ── ShiftCard ─────────────────────────────────────────────────────────────────

function ShiftCard({ shift, onPress, canEdit }: {
    shift: ShiftDetail;
    onPress: () => void;
    canEdit: boolean;
}) {
    const isDraft = shift.status === 'draft';
    const isPublished = shift.status === 'published';
    const isCancelled = shift.status === 'cancelled';

    const statusColor =
        isDraft ? colors.warning :
            isPublished ? colors.success :
                colors.gray;

    const statusLabel = isDraft ? 'DRAFT' : isPublished ? 'LIVE' : 'CANCELLED';

    // ── Is this shift happening right now? If so, show elapsed-time progress ──
    const now   = Date.now();
    const start = new Date(shift.start_time).getTime();
    const end   = new Date(shift.end_time).getTime();
    const isLiveNow = isPublished && now >= start && now < end;
    const liveProgress = isLiveNow
        ? Math.min(Math.max((now - start) / (end - start), 0), 1)
        : 0;

    return (
        <Pressable
            style={({ pressed }) => [
                styles.shiftCard,
                { borderLeftColor: statusColor },
                pressed && canEdit && { opacity: 0.85 },
                isCancelled && { opacity: 0.5 },
            ]}
            onPress={onPress}
            disabled={!canEdit}
        >
            <View style={styles.shiftCardTop}>
                <Text style={styles.shiftTime}>
                    {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    {shift.created_by_ai && (
                        <Ionicons name="sparkles" size={10} color={statusColor} />
                    )}
                    <Text style={[styles.statusText, { color: statusColor }]}>
                        {isLiveNow ? 'HAPPENING NOW' : statusLabel}
                    </Text>
                </View>
            </View>

            <View style={styles.shiftCardBottom}>
                {shift.role && (
                    <View style={styles.shiftMeta}>
                        <Ionicons name="briefcase-outline" size={12} color={colors.gray} />
                        <Text style={styles.shiftMetaText}>{shift.role}</Text>
                    </View>
                )}
                <View style={styles.shiftMeta}>
                    <Ionicons name="people-outline" size={12} color={colors.gray} />
                    <Text style={styles.shiftMetaText}>
                        {shift.assignments.length} assigned
                    </Text>
                </View>
                {shift.break_minutes > 0 && (
                    <View style={styles.shiftMeta}>
                        <Ionicons name="cafe-outline" size={12} color={colors.gray} />
                        <Text style={styles.shiftMetaText}>{shift.break_minutes}m break</Text>
                    </View>
                )}
            </View>

            {shift.notes ? (
                <Text style={styles.shiftNotes} numberOfLines={1}>{shift.notes}</Text>
            ) : null}

            {isLiveNow && (
                <View style={styles.liveTrack}>
                    <View style={[styles.liveFill, { width: `${liveProgress * 100}%` }]} />
                </View>
            )}
        </Pressable>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        backgroundColor: '#fff',
    },
    backBtn: { padding: 4, marginRight: 8 },
    screenTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
    todayBtn: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    todayBtnText: { fontSize: 12, color: colors.primary, fontWeight: '600' },

    bulkBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: colors.primary,
    },
    bulkBtnText: { fontSize: 12, color: '#fff', fontWeight: '700' },

    locationBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: colors.subtleAccent,
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 11,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    locationOptionActive: { backgroundColor: colors.subtleAccent },
    locationOptionText: { fontSize: 14, color: colors.text },

    weekNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        backgroundColor: '#fff',
    },
    weekNavBtn: { padding: 8 },
    weekLabel: { fontSize: 13, fontWeight: '700', color: colors.text },

    laborBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: colors.subtleCard,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#EFEFEF',
    },
    laborDivider: { width: 1, height: 24, backgroundColor: '#E0E0E0' },

    scroll: { flex: 1 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { fontSize: 13, color: colors.gray },

    dayBlock: {
        marginHorizontal: 16,
        marginTop: 10,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F0F0F0',
        backgroundColor: '#FAFAFA',
    },
    dayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        gap: 8,
    },
    dayBadge: {
        alignItems: 'center',
        width: 36,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    dayBadgeToday: { backgroundColor: colors.primary },
    dayShort: { fontSize: 9, fontWeight: '700', color: colors.gray },
    dayShortToday: { color: '#fff' },
    dayNum: { fontSize: 15, fontWeight: '800', color: colors.text },
    dayNumToday: { color: '#fff' },
    shiftCount: { flex: 1, fontSize: 12, color: colors.gray },
    addShiftBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: colors.subtleAccent,
        alignItems: 'center',
        justifyContent: 'center',
    },

    shiftCard: {
        margin: 8,
        padding: 10,
        paddingBottom: 13,
        borderRadius: 10,
        backgroundColor: '#fff',
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 3,
        elevation: 1,
        overflow: 'hidden',
        position: 'relative',
    },
    liveTrack: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: colors.inputBorder,
    },
    liveFill: {
        height: 3,
        backgroundColor: colors.primary,
    },
    shiftCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    shiftTime: { fontSize: 13, fontWeight: '700', color: colors.text },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 999,
    },
    statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
    shiftCardBottom: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    shiftMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    shiftMetaText: { fontSize: 11, color: colors.gray },
    shiftNotes: { marginTop: 4, fontSize: 11, color: colors.gray, fontStyle: 'italic' },

    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 10,
        paddingBottom: 24,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 8,
    },
    createBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 11,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: colors.primary,
        backgroundColor: '#fff',
    },
    createBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
    publishBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 11,
        borderRadius: 999,
        backgroundColor: colors.success,
    },
    publishBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});