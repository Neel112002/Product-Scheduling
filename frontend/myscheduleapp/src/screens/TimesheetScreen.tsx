// src/screens/TimesheetScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { colors }       from '../theme/colors';
import { TimeEntryAPI } from '../api/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type BreakEntry = {
    break_id:          number;
    break_start:       string;
    break_end?:        string | null;
    duration_minutes?: number | null;
    is_active:         boolean;
};

type TimeEntry = {
    entry_id:      number;
    shift_id?:     number | null;
    clock_in:      string;
    clock_out?:    string | null;
    total_minutes?: number | null;
    notes?:        string | null;
    breaks:        BreakEntry[];
    break_count:   number;
};

type WeeklySummary = {
    week_start:    string;
    total_entries: number;
    total_minutes: number;
    total_hours:   number;
    break_minutes: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-CA', {
        hour:   '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-CA', {
        weekday: 'long',
        month:   'short',
        day:     'numeric',
    });
}

function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
    return `${m}m`;
}

function isToday(iso: string): boolean {
    const d     = new Date(iso);
    const today = new Date();
    return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth()    === today.getMonth()    &&
        d.getDate()     === today.getDate()
    );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TimesheetScreen({ navigation }: any) {
    const [entries,   setEntries]   = useState<TimeEntry[]>([]);
    const [summary,   setSummary]   = useState<WeeklySummary | null>(null);
    const [loading,   setLoading]   = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const { data } = await TimeEntryAPI.getHistory(30);
            setEntries(data.entries   ?? []);
            setSummary(data.weekly_summary ?? null);
        } catch {
            setEntries([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, [fetchData]);

    // ── Render entry ──────────────────────────────────────────────────────────
    const renderEntry = ({ item }: { item: TimeEntry }) => {
        const today        = isToday(item.clock_in);
        const totalBreaks  = item.breaks.reduce(
            (acc, b) => acc + (b.duration_minutes ?? 0), 0
        );

        return (
            <View style={[styles.entryCard, today && styles.entryCardToday]}>
                {/* Date header */}
                <View style={styles.entryHeader}>
                    <Text style={[styles.entryDate, today && { color: colors.primary }]}>
                        {today ? 'Today' : formatDate(item.clock_in)}
                    </Text>
                    {item.total_minutes !== null && item.total_minutes !== undefined && (
                        <View style={styles.totalBadge}>
                            <Text style={styles.totalBadgeText}>
                                {formatDuration(item.total_minutes)}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Timeline */}
                <View style={styles.timeline}>

                    {/* Clock in */}
                    <TimelineRow
                        icon="log-in-outline"
                        color={colors.success}
                        label="Clocked in"
                        time={formatTime(item.clock_in)}
                    />

                    {/* Breaks */}
                    {item.breaks.map((brk, idx) => (
                        <React.Fragment key={brk.break_id}>
                            <TimelineRow
                                icon="cafe-outline"
                                color={colors.warning}
                                label={`Break ${item.breaks.length > 1 ? idx + 1 : ''} started`}
                                time={formatTime(brk.break_start)}
                            />
                            {brk.break_end && (
                                <TimelineRow
                                    icon="play-outline"
                                    color={colors.warning}
                                    label={`Break ended (${brk.duration_minutes}m)`}
                                    time={formatTime(brk.break_end)}
                                />
                            )}
                        </React.Fragment>
                    ))}

                    {/* Clock out */}
                    {item.clock_out ? (
                        <TimelineRow
                            icon="log-out-outline"
                            color={colors.error}
                            label="Clocked out"
                            time={formatTime(item.clock_out)}
                            isLast
                        />
                    ) : (
                        <TimelineRow
                            icon="ellipsis-horizontal"
                            color={colors.gray}
                            label="Still working..."
                            time="—"
                            isLast
                        />
                    )}
                </View>

                {/* Summary row */}
                <View style={styles.entrySummary}>
                    {item.shift_id && (
                        <View style={styles.summaryChip}>
                            <Ionicons name="calendar-outline" size={12} color={colors.gray} />
                            <Text style={styles.summaryChipText}>Shift #{item.shift_id}</Text>
                        </View>
                    )}
                    {totalBreaks > 0 && (
                        <View style={styles.summaryChip}>
                            <Ionicons name="cafe-outline" size={12} color={colors.gray} />
                            <Text style={styles.summaryChipText}>{totalBreaks}m breaks</Text>
                        </View>
                    )}
                    {item.notes && (
                        <View style={styles.summaryChip}>
                            <Ionicons name="document-text-outline" size={12} color={colors.gray} />
                            <Text style={styles.summaryChipText} numberOfLines={1}>
                                {item.notes}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    // ── Empty ─────────────────────────────────────────────────────────────────
    const EmptyState = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={48} color={colors.inputBorder} />
            <Text style={styles.emptyTitle}>No timesheet entries yet</Text>
            <Text style={styles.emptySubtitle}>
                Your clock-in history will appear here.
            </Text>
            <Pressable
                style={styles.clockInNowBtn}
                onPress={() => navigation.replace('ClockIn')}
            >
                <Text style={styles.clockInNowText}>Clock In Now</Text>
            </Pressable>
        </View>
    );

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Timesheet</Text>
                <Pressable
                    onPress={() => navigation.navigate('ClockIn')}
                    style={styles.clockBtn}
                >
                    <Ionicons name="log-in-outline" size={22} color={colors.primary} />
                </Pressable>
            </View>

            {/* Weekly summary */}
            {summary && (
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryCardTitle}>This Week</Text>
                    <View style={styles.summaryRow}>
                        <SummaryItem
                            icon="calendar-outline"
                            value={String(summary.total_entries)}
                            label="days"
                        />
                        <View style={styles.summaryDivider} />
                        <SummaryItem
                            icon="time-outline"
                            value={`${summary.total_hours}h`}
                            label="worked"
                        />
                        <View style={styles.summaryDivider} />
                        <SummaryItem
                            icon="cafe-outline"
                            value={`${summary.break_minutes}m`}
                            label="breaks"
                        />
                    </View>
                </View>
            )}

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={entries}
                    keyExtractor={item => String(item.entry_id)}
                    renderItem={renderEntry}
                    ListEmptyComponent={EmptyState}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    contentContainerStyle={[
                        styles.listContent,
                        entries.length === 0 && styles.listContentEmpty,
                    ]}
                    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                />
            )}
        </SafeAreaView>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TimelineRow({
    icon,
    color,
    label,
    time,
    isLast = false,
}: {
    icon:    React.ComponentProps<typeof Ionicons>['name'];
    color:   string;
    label:   string;
    time:    string;
    isLast?: boolean;
}) {
    return (
        <View style={tlStyles.row}>
            <View style={tlStyles.dotCol}>
                <View style={[tlStyles.dot, { backgroundColor: color }]}>
                    <Ionicons name={icon} size={10} color="#fff" />
                </View>
                {!isLast && <View style={tlStyles.line} />}
            </View>
            <View style={tlStyles.content}>
                <Text style={tlStyles.label}>{label}</Text>
                <Text style={tlStyles.time}>{time}</Text>
            </View>
        </View>
    );
}

function SummaryItem({
    icon,
    value,
    label,
}: {
    icon:  React.ComponentProps<typeof Ionicons>['name'];
    value: string;
    label: string;
}) {
    return (
        <View style={sumStyles.item}>
            <Ionicons name={icon} size={18} color={colors.primary} />
            <Text style={sumStyles.value}>{value}</Text>
            <Text style={sumStyles.label}>{label}</Text>
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:             { flex: 1, backgroundColor: '#F8F8FC' },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent:      { padding: 16 },
    listContentEmpty: { flex: 1 },

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
    clockBtn:    { padding: 4 },

    summaryCard: {
        backgroundColor:   '#fff',
        paddingVertical:   16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    summaryCardTitle: {
        fontSize:     12,
        fontWeight:   '700',
        color:        colors.gray,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 12,
    },
    summaryRow:     { flexDirection: 'row', alignItems: 'center' },
    summaryDivider: { width: 1, height: 36, backgroundColor: '#EFEFEF', marginHorizontal: 16 },

    entryCard: {
        backgroundColor: '#fff',
        borderRadius:    16,
        padding:         16,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        shadowColor:     '#000',
        shadowOpacity:   0.04,
        shadowRadius:    6,
        elevation:       2,
    },
    entryCardToday: {
        borderColor:     colors.primary + '30',
        backgroundColor: colors.primary + '03',
    },
    entryHeader: {
        flexDirection:  'row',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   14,
    },
    entryDate: { fontSize: 15, fontWeight: '700', color: colors.text },
    totalBadge: {
        paddingHorizontal: 12,
        paddingVertical:    4,
        borderRadius:      999,
        backgroundColor:   colors.success + '18',
    },
    totalBadgeText: { fontSize: 13, fontWeight: '700', color: colors.success },

    timeline: { marginBottom: 12 },

    entrySummary: {
        flexDirection: 'row',
        flexWrap:      'wrap',
        gap:           8,
        marginTop:     4,
    },
    summaryChip: {
        flexDirection:     'row',
        alignItems:        'center',
        gap:               4,
        backgroundColor:   '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical:    4,
        borderRadius:      999,
    },
    summaryChipText: { fontSize: 11, color: colors.gray },

    emptyContainer: {
        flex:           1,
        alignItems:     'center',
        justifyContent: 'center',
        padding:        40,
        gap:            12,
    },
    emptyTitle:    { fontSize: 18, fontWeight: '700', color: colors.text },
    emptySubtitle: { fontSize: 13, color: colors.gray, textAlign: 'center' },
    clockInNowBtn: {
        marginTop:         8,
        paddingHorizontal: 24,
        paddingVertical:   12,
        borderRadius:      999,
        backgroundColor:   colors.primary,
    },
    clockInNowText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

const tlStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        gap:           12,
        minHeight:     36,
    },
    dotCol: {
        alignItems: 'center',
        width:      20,
    },
    dot: {
        width:          20,
        height:         20,
        borderRadius:   10,
        alignItems:     'center',
        justifyContent: 'center',
    },
    line: {
        width:           2,
        flex:            1,
        backgroundColor: '#E5E7EB',
        marginVertical:  2,
    },
    content: {
        flex:           1,
        flexDirection:  'row',
        alignItems:     'center',
        justifyContent: 'space-between',
        paddingBottom:  8,
    },
    label: { fontSize: 13, color: colors.text },
    time:  { fontSize: 13, fontWeight: '600', color: colors.text },
});

const sumStyles = StyleSheet.create({
    item:  { flex: 1, alignItems: 'center', gap: 4 },
    value: { fontSize: 18, fontWeight: '800', color: colors.text },
    label: { fontSize: 11, color: colors.gray },
});