// src/screens/admin/AnalyticsScreen.tsx
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
    RefreshControl,
    Dimensions,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';

import { colors } from '../../theme/colors';
import { AnalyticsAPI } from '../../api/api';
import { AuthContext } from '../../context/AuthContext';
import { useQuery } from '@apollo/client/react';
import { MY_LOCATIONS_QUERY } from '../../graphql/operations';

// ── Constants ─────────────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - 48;
const CHART_H = 180;

const ROLE_COLORS = [
    '#7B4AE2', '#10B981', '#F59E0B',
    '#6366F1', '#EF4444', '#0EA5E9',
];

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = 'day' | 'week' | 'month';

type Summary = {
    scheduled_hours: number;
    worked_hours: number;
    labor_cost: number;
    coverage_pct: number;
    late_clockins: number;
    overtime_hours: number;
    total_shifts: number;
    total_staff: number;
};

type DayData = { date: string; day: string; worked: number };
type TrendData = { label: string; hours: number; cost: number };
type RoleData = { role: string; hours: number; pct: number };
type EmployeeData = { name: string; hours: number; role: string };
type LateEntry = { name: string; date: string; mins_late: number };

type AnalyticsData = {
    period: Period;
    start: string;
    end: string;
    date_label: string;
    summary: Summary;
    hours_per_day: DayData[];
    hours_per_employee: EmployeeData[];
    trend_data: TrendData[];
    hours_by_role: RoleData[];
    late_list: LateEntry[];
};

type Location = { id: number; name: string };
type MyLocationsData = { myLocations: Location[] };

// ── Chart config ──────────────────────────────────────────────────────────────

const chartConfig = {
    backgroundColor: '#fff',
    backgroundGradientFrom: '#fff',
    backgroundGradientTo: '#fff',
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(123, 74, 226, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    style: { borderRadius: 12 },
    propsForDots: { r: '4', strokeWidth: '2', stroke: colors.primary },
    propsForLabels: { fontSize: 10 },
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatStartDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    d.setHours(0, 0, 0, 0);
    return d;
}

function navigateDate(date: Date, period: Period, direction: 1 | -1): Date {
    const d = new Date(date);
    if (period === 'day') d.setDate(d.getDate() + direction);
    else if (period === 'week') d.setDate(d.getDate() + direction * 7);
    else d.setMonth(d.getMonth() + direction);
    return d;
}

function getDefaultDate(period: Period): Date {
    const now = new Date();
    if (period === 'week') {
        const dow = now.getDay();
        now.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    } else if (period === 'month') {
        now.setDate(1);
    }
    return now;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AnalyticsScreen({ navigation, route }: any) {
    const { user } = useContext(AuthContext);

    const [period, setPeriod] = useState<Period>('week');
    const [currentDate, setCurrentDate] = useState<Date>(getDefaultDate('week'));
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);
    const [selectedLocId, setSelectedLocId] = useState<number | null>(
        route?.params?.locationId ?? user?.primaryLocation?.id ?? null
    );

    // ── Locations ─────────────────────────────────────────────────────────────
    const { data: locData } = useQuery<MyLocationsData>(MY_LOCATIONS_QUERY, {
        fetchPolicy: 'cache-and-network',
    });
    const locations = locData?.myLocations ?? [];

    useEffect(() => {
        if (locations.length && !selectedLocId) {
            setSelectedLocId(locations[0].id);
        }
    }, [locations]);

    // ── Change period ─────────────────────────────────────────────────────────
    const handleChangePeriod = (p: Period) => {
        setPeriod(p);
        setCurrentDate(getDefaultDate(p));
    };

    // ── Navigate ──────────────────────────────────────────────────────────────
    const handleNavigate = (direction: 1 | -1) => {
        setCurrentDate(prev => navigateDate(prev, period, direction));
    };

    // ── Calendar date selected ────────────────────────────────────────────────
    const handleCalendarSelect = (day: { dateString: string }) => {
        const selected = new Date(day.dateString + 'T00:00:00');
        if (period === 'week') {
            setCurrentDate(getWeekStart(selected));
        } else if (period === 'month') {
            const d = new Date(selected);
            d.setDate(1);
            setCurrentDate(d);
        } else {
            setCurrentDate(selected);
        }
        setShowCalendar(false);
    };

    // ── Calendar marked dates ─────────────────────────────────────────────────
    const markedDates = useMemo(() => {
        const marks: Record<string, any> = {};

        if (period === 'day') {
            const key = formatStartDate(currentDate);
            marks[key] = {
                selected: true,
                selectedColor: colors.primary,
            };
        } else if (period === 'week') {
            const ws = getWeekStart(currentDate);
            for (let i = 0; i < 7; i++) {
                const d = new Date(ws);
                d.setDate(d.getDate() + i);
                const key = formatStartDate(d);
                marks[key] = {
                    color: colors.primary,
                    textColor: '#fff',
                    startingDay: i === 0,
                    endingDay: i === 6,
                };
            }
        } else {
            // Month — mark all days of current month
            const d = new Date(currentDate);
            d.setDate(1);
            const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            while (d <= monthEnd) {
                const key = formatStartDate(d);
                marks[key] = {
                    color: colors.primary + '40',
                    textColor: colors.text,
                    startingDay: d.getDate() === 1,
                    endingDay: d.getDate() === monthEnd.getDate(),
                };
                d.setDate(d.getDate() + 1);
            }
        }
        return marks;
    }, [currentDate, period]);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        if (!selectedLocId) return;
        try {
            const { data: res } = await AnalyticsAPI.get(
                selectedLocId,
                period,
                formatStartDate(currentDate),
            );
            setData(res);
        } catch {
            setData(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedLocId, period, currentDate]);

    useEffect(() => {
        setLoading(true);
        fetchData();
    }, [fetchData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, [fetchData]);

    // ── Chart data ────────────────────────────────────────────────────────────

    const barData = useMemo(() => {
        if (period === 'day') {
            const emps = data?.hours_per_employee ?? [];
            if (emps.length === 0) return { labels: ['—'], datasets: [{ data: [0] }] };
            return {
                labels: emps.map(e => e.name),
                datasets: [{ data: emps.map(e => Math.max(e.hours, 0)) }],
            };
        }
        if (period === 'week') {
            const days = data?.hours_per_day ?? [];
            if (days.length === 0) return { labels: ['—'], datasets: [{ data: [0] }] };
            return {
                labels: days.map(d => d.day),
                datasets: [{ data: days.map(d => Math.max(d.worked, 0)) }],
            };
        }
        const days = data?.hours_per_day ?? [];
        if (days.length === 0) return { labels: ['—'], datasets: [{ data: [0] }] };
        const weeks: { label: string; hours: number }[] = [];
        for (let i = 0; i < days.length; i += 7) {
            const chunk = days.slice(i, i + 7);
            weeks.push({
                label: `Wk${Math.floor(i / 7) + 1}`,
                hours: Math.round(chunk.reduce((s, d) => s + (d.worked || 0), 0) * 10) / 10,
            });
        }
        return {
            labels: weeks.map(w => w.label),
            datasets: [{ data: weeks.map(w => Math.max(w.hours, 0)) }],
        };
    }, [data, period]);

    const lineData = useMemo(() => {
        const trend = data?.trend_data ?? [];
        if (trend.length === 0) return { labels: ['—'], datasets: [{ data: [0], strokeWidth: 2 }] };
        return {
            labels: trend.map(t => t.label),
            datasets: [{ data: trend.map(t => Math.max(t.hours, 0)), strokeWidth: 2 }],
        };
    }, [data]);

    const pieData = useMemo(() =>
        (data?.hours_by_role ?? [])
            .filter(r => r.hours > 0)
            .map((r, i) => ({
                name: r.role,
                population: r.hours,
                color: ROLE_COLORS[i % ROLE_COLORS.length],
                legendFontColor: colors.gray,
                legendFontSize: 12,
            })),
        [data]
    );

    const barIsEmpty = barData.datasets[0].data.every(v => v === 0);
    const lineIsEmpty = lineData.datasets[0].data.every(v => v === 0);

    const locationName = useMemo(
        () => locations.find(l => l.id === selectedLocId)?.name ?? '',
        [locations, selectedLocId]
    );

    const barTitle = period === 'day' ? 'Hours per Employee'
        : period === 'week' ? 'Hours per Day'
            : 'Hours per Week';

    const trendTitle = period === 'month'
        ? 'Monthly Trend (last 4 months)'
        : 'Weekly Trend (last 4 weeks)';

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>

            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Analytics</Text>
                    {locationName ? <Text style={styles.headerSub}>{locationName}</Text> : null}
                </View>
            </View>

            {/* Period selector */}
            <View style={styles.periodBar}>
                {(['day', 'week', 'month'] as Period[]).map(p => (
                    <Pressable
                        key={p}
                        style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                        onPress={() => handleChangePeriod(p)}
                    >
                        <Text style={[
                            styles.periodBtnText,
                            period === p && styles.periodBtnTextActive,
                        ]}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* Date navigator */}
            <View style={styles.dateNav}>
                <Pressable style={styles.dateNavBtn} onPress={() => handleNavigate(-1)}>
                    <Ionicons name="chevron-back" size={20} color={colors.text} />
                </Pressable>

                {/* ✅ Tapping label opens calendar */}
                <Pressable
                    style={styles.dateNavLabelBtn}
                    onPress={() => setShowCalendar(true)}
                >
                    <Text style={styles.dateNavLabel} numberOfLines={1}>
                        {data?.date_label ?? '...'}
                    </Text>
                    <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                </Pressable>

                <Pressable style={styles.dateNavBtn} onPress={() => handleNavigate(1)}>
                    <Ionicons name="chevron-forward" size={20} color={colors.text} />
                </Pressable>
            </View>

            {/* ── Calendar picker modal ── */}
            <Modal
                visible={showCalendar}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCalendar(false)}
            >
                <Pressable
                    style={styles.modalBackdrop}
                    onPress={() => setShowCalendar(false)}
                >
                    <Pressable
                        style={styles.calendarSheet}
                        onPress={e => e.stopPropagation()}
                    >
                        {/* Modal header */}
                        <View style={styles.calendarHeader}>
                            <Text style={styles.calendarTitle}>
                                {period === 'day' ? 'Select a day' :
                                    period === 'week' ? 'Select a week' :
                                        'Select a month'}
                            </Text>
                            <Pressable
                                onPress={() => setShowCalendar(false)}
                                style={styles.calendarCloseBtn}
                            >
                                <Ionicons name="close" size={22} color={colors.text} />
                            </Pressable>
                        </View>

                        {/* Calendar */}
                        <Calendar
                            onDayPress={handleCalendarSelect}
                            markedDates={markedDates}
                            markingType={period === 'day' ? 'dot' : 'period'}
                            theme={{
                                backgroundColor: '#fff',
                                calendarBackground: '#fff',
                                selectedDayBackgroundColor: colors.primary,
                                selectedDayTextColor: '#fff',
                                todayTextColor: colors.primary,
                                dayTextColor: colors.text,
                                textDisabledColor: colors.inputBorder,
                                dotColor: colors.primary,
                                monthTextColor: colors.text,
                                arrowColor: colors.primary,
                                textMonthFontWeight: '700',
                                textDayFontSize: 14,
                                textMonthFontSize: 16,
                            }}
                        />

                        {/* Jump to today */}
                        <Pressable
                            style={styles.todayBtn}
                            onPress={() => {
                                handleCalendarSelect({
                                    dateString: formatStartDate(new Date()),
                                });
                            }}
                        >
                            <Ionicons name="today-outline" size={16} color="#fff" />
                            <Text style={styles.todayBtnText}>Jump to Today</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Content */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading analytics...</Text>
                </View>
            ) : !data ? (
                <View style={styles.loadingContainer}>
                    <Ionicons name="bar-chart-outline" size={48} color={colors.inputBorder} />
                    <Text style={styles.emptyText}>No data available</Text>
                    <Pressable onPress={onRefresh} style={styles.retryBtn}>
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </Pressable>
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {/* Summary cards */}
                    <View style={styles.summaryGrid}>
                        <SummaryCard icon="time-outline" label="Scheduled" value={`${data.summary.scheduled_hours}h`} color="#6366F1" />
                        <SummaryCard icon="checkmark-circle-outline" label="Worked" value={`${data.summary.worked_hours}h`} color={colors.success} />
                        <SummaryCard icon="cash-outline" label="Cost" value={`$${data.summary.labor_cost.toFixed(0)}`} color="#F59E0B" />
                        <SummaryCard
                            icon="stats-chart-outline"
                            label="Coverage"
                            value={`${data.summary.coverage_pct}%`}
                            color={data.summary.coverage_pct >= 80 ? colors.success : data.summary.coverage_pct >= 60 ? '#F59E0B' : colors.error}
                        />
                        <SummaryCard
                            icon="alert-circle-outline"
                            label="Late ins"
                            value={String(data.summary.late_clockins)}
                            color={data.summary.late_clockins > 0 ? colors.error : colors.success}
                        />
                        <SummaryCard
                            icon="trending-up-outline"
                            label="Overtime"
                            value={`${data.summary.overtime_hours}h`}
                            color={data.summary.overtime_hours > 0 ? colors.warning : colors.success}
                        />
                    </View>

                    {/* Bar chart */}
                    <View style={styles.chartCard}>
                        <Text style={styles.chartTitle}>{barTitle}</Text>
                        <Text style={styles.chartSub}>{data.date_label}</Text>
                        {barIsEmpty ? (
                            <EmptyChart message="No hours recorded" />
                        ) : (
                            <BarChart
                                data={barData}
                                width={CHART_W}
                                height={CHART_H}
                                chartConfig={chartConfig}
                                style={styles.chart}
                                showValuesOnTopOfBars
                                fromZero
                                yAxisLabel=""
                                yAxisSuffix="h"
                                withInnerLines={false}
                            />
                        )}
                    </View>

                    {/* Line chart — hide for day with no data */}
                    {!(period === 'day' && lineIsEmpty) && (
                        <View style={styles.chartCard}>
                            <Text style={styles.chartTitle}>{trendTitle}</Text>
                            {lineIsEmpty ? (
                                <EmptyChart message="No trend data available" />
                            ) : (
                                <>
                                    <LineChart
                                        data={lineData}
                                        width={CHART_W}
                                        height={CHART_H}
                                        chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(123, 74, 226, ${opacity})` }}
                                        style={styles.chart}
                                        bezier
                                        fromZero
                                        yAxisLabel=""
                                        yAxisSuffix="h"
                                        withInnerLines={false}
                                        withShadow={false}
                                    />
                                    <View style={styles.trendCostRow}>
                                        {data.trend_data.map((t, i) => (
                                            <View key={i} style={styles.trendCostItem}>
                                                <Text style={styles.trendCostLabel}>{t.label}</Text>
                                                <Text style={styles.trendCostValue}>${t.cost.toFixed(0)}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            )}
                        </View>
                    )}

                    {/* Pie chart */}
                    <View style={styles.chartCard}>
                        <Text style={styles.chartTitle}>Hours by Role</Text>
                        <Text style={styles.chartSub}>{data.date_label}</Text>
                        {pieData.length === 0 ? (
                            <EmptyChart message="No role data available" />
                        ) : (
                            <>
                                <PieChart
                                    data={pieData}
                                    width={CHART_W}
                                    height={180}
                                    chartConfig={chartConfig}
                                    accessor="population"
                                    backgroundColor="transparent"
                                    paddingLeft="0"
                                    style={styles.chart}
                                    absolute={false}
                                />
                                <View style={styles.roleList}>
                                    {data.hours_by_role.filter(r => r.hours > 0).map((r, i) => (
                                        <View key={r.role} style={styles.roleRow}>
                                            <View style={[styles.roleDot, { backgroundColor: ROLE_COLORS[i % ROLE_COLORS.length] }]} />
                                            <Text style={styles.roleName}>{r.role}</Text>
                                            <Text style={styles.roleHours}>{r.hours}h</Text>
                                            <Text style={styles.rolePct}>{r.pct}%</Text>
                                        </View>
                                    ))}
                                </View>
                            </>
                        )}
                    </View>

                    {/* Coverage */}
                    <View style={styles.chartCard}>
                        <Text style={styles.chartTitle}>Shift Coverage</Text>
                        <View style={styles.coverageRow}>
                            <View style={styles.coverageItem}>
                                <Text style={styles.coverageValue}>{data.summary.total_shifts}</Text>
                                <Text style={styles.coverageLabel}>Shifts</Text>
                            </View>
                            <View style={styles.coverageItem}>
                                <Text style={styles.coverageValue}>{data.summary.total_staff}</Text>
                                <Text style={styles.coverageLabel}>Staff</Text>
                            </View>
                            <View style={styles.coverageItem}>
                                <Text style={[
                                    styles.coverageValue,
                                    { color: data.summary.coverage_pct >= 80 ? colors.success : data.summary.coverage_pct >= 60 ? '#F59E0B' : colors.error },
                                ]}>
                                    {data.summary.coverage_pct}%
                                </Text>
                                <Text style={styles.coverageLabel}>Coverage</Text>
                            </View>
                        </View>
                        <View style={styles.progressBarBg}>
                            <View style={[
                                styles.progressBarFill,
                                {
                                    width: `${Math.min(data.summary.coverage_pct, 100)}%` as any,
                                    backgroundColor: data.summary.coverage_pct >= 80 ? colors.success : data.summary.coverage_pct >= 60 ? '#F59E0B' : colors.error,
                                },
                            ]} />
                        </View>
                        <Text style={styles.progressLabel}>
                            {data.summary.scheduled_hours}h scheduled  ·  {data.summary.worked_hours}h worked
                        </Text>
                    </View>

                    {/* Late clock-ins */}
                    {data.late_list.length > 0 && (
                        <View style={styles.chartCard}>
                            <Text style={styles.chartTitle}>Late Clock-ins</Text>
                            <Text style={styles.chartSub}>
                                {data.summary.late_clockins} incident{data.summary.late_clockins !== 1 ? 's' : ''}
                            </Text>
                            {data.late_list.map((item, i) => (
                                <View key={i} style={styles.lateRow}>
                                    <View style={styles.lateAvatar}>
                                        <Text style={styles.lateAvatarText}>
                                            {item.name.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={styles.lateInfo}>
                                        <Text style={styles.lateName}>{item.name}</Text>
                                        <Text style={styles.lateDate}>{item.date}</Text>
                                    </View>
                                    <View style={styles.lateBadge}>
                                        <Ionicons name="time-outline" size={12} color={colors.error} />
                                        <Text style={styles.lateMins}>{item.mins_late}m late</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Overtime */}
                    {data.summary.overtime_hours > 0 && (
                        <View style={[styles.chartCard, styles.overtimeCard]}>
                            <View style={styles.overtimeRow}>
                                <View style={styles.overtimeIconWrap}>
                                    <Ionicons name="trending-up-outline" size={22} color={colors.warning} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.overtimeTitle}>Overtime Detected</Text>
                                    <Text style={styles.overtimeSub}>
                                        {data.summary.overtime_hours}h overtime (beyond 8h/day)
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

// ── SummaryCard ───────────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, color }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string; value: string; color: string;
}) {
    return (
        <View style={summaryStyles.card}>
            <View style={[summaryStyles.iconWrap, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={18} color={color} />
            </View>
            <Text style={[summaryStyles.value, { color }]}>{value}</Text>
            <Text style={summaryStyles.label}>{label}</Text>
        </View>
    );
}

const summaryStyles = StyleSheet.create({
    card: {
        width: '30%', backgroundColor: '#fff', borderRadius: 14,
        padding: 12, alignItems: 'center', gap: 4,
        borderWidth: 1, borderColor: '#EFEFEF',
        shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
    },
    iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    value: { fontSize: 16, fontWeight: '800' },
    label: { fontSize: 10, color: colors.gray, textAlign: 'center' },
});

// ── EmptyChart ────────────────────────────────────────────────────────────────

function EmptyChart({ message }: { message: string }) {
    return (
        <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
            <Ionicons name="bar-chart-outline" size={32} color={colors.inputBorder} />
            <Text style={{ fontSize: 12, color: colors.gray }}>{message}</Text>
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8F8FC' },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 40 },

    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { fontSize: 13, color: colors.gray },
    emptyText: { fontSize: 15, fontWeight: '600', color: colors.gray },
    retryBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.primary },
    retryBtnText: { color: '#fff', fontWeight: '700' },

    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 10,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 8,
    },
    backBtn: { padding: 4 },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    headerSub: { fontSize: 11, color: colors.gray, marginTop: 1 },

    periodBar: {
        flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
        gap: 8,
    },
    periodBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999 },
    periodBtnActive: { backgroundColor: colors.primary },
    periodBtnText: { fontSize: 13, color: colors.gray, fontWeight: '600' },
    periodBtnTextActive: { color: '#fff' },

    // Date navigator
    dateNav: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 8, paddingVertical: 10,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    dateNavBtn: { padding: 8 },
    dateNavLabelBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'center', gap: 6,
        paddingVertical: 6, paddingHorizontal: 12,
        borderRadius: 999, backgroundColor: colors.subtleAccent,
        marginHorizontal: 4,
    },
    dateNavLabel: { fontSize: 13, fontWeight: '700', color: colors.text },

    // Calendar modal
    modalBackdrop: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    calendarSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingBottom: 32,
        shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 20,
    },
    calendarHeader: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    calendarTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    calendarCloseBtn: { padding: 4 },
    todayBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, marginHorizontal: 20, marginTop: 12,
        paddingVertical: 12, borderRadius: 999,
        backgroundColor: colors.primary,
    },
    todayBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    summaryGrid: {
        flexDirection: 'row', flexWrap: 'wrap',
        gap: 10, marginBottom: 16, justifyContent: 'space-between',
    },

    chartCard: {
        backgroundColor: '#fff', borderRadius: 16, padding: 16,
        marginBottom: 12, borderWidth: 1, borderColor: '#EFEFEF',
        shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
    },
    chartTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    chartSub: { fontSize: 12, color: colors.gray, marginBottom: 12, marginTop: 2 },
    chart: { borderRadius: 12, marginLeft: -16 },

    trendCostRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
    trendCostItem: { alignItems: 'center', gap: 2 },
    trendCostLabel: { fontSize: 10, color: colors.gray },
    trendCostValue: { fontSize: 12, fontWeight: '700', color: colors.text },

    roleList: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0', gap: 8 },
    roleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    roleDot: { width: 10, height: 10, borderRadius: 5 },
    roleName: { flex: 1, fontSize: 13, color: colors.text, fontWeight: '600' },
    roleHours: { fontSize: 13, color: colors.text, fontWeight: '700', minWidth: 36, textAlign: 'right' },
    rolePct: { fontSize: 12, color: colors.gray, minWidth: 40, textAlign: 'right' },

    coverageRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
    coverageItem: { alignItems: 'center', gap: 4 },
    coverageValue: { fontSize: 22, fontWeight: '800', color: colors.text },
    coverageLabel: { fontSize: 11, color: colors.gray },
    progressBarBg: { height: 10, backgroundColor: '#F3F4F6', borderRadius: 999, overflow: 'hidden', marginBottom: 8 },
    progressBarFill: { height: '100%', borderRadius: 999 },
    progressLabel: { fontSize: 11, color: colors.gray, textAlign: 'center' },

    lateRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    lateAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.error + '20', alignItems: 'center', justifyContent: 'center' },
    lateAvatarText: { fontSize: 13, fontWeight: '700', color: colors.error },
    lateInfo: { flex: 1 },
    lateName: { fontSize: 13, fontWeight: '600', color: colors.text },
    lateDate: { fontSize: 11, color: colors.gray, marginTop: 1 },
    lateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.error + '12', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    lateMins: { fontSize: 11, color: colors.error, fontWeight: '700' },

    overtimeCard: { borderColor: colors.warning + '40', backgroundColor: colors.warning + '05' },
    overtimeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    overtimeIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.warning + '20', alignItems: 'center', justifyContent: 'center' },
    overtimeTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    overtimeSub: { fontSize: 12, color: colors.gray, marginTop: 2 },
});