import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fmtTime, getCountdown, fmtDayDate } from '../../utils/datetime';

export type Shift = {
    id: string;
    role: string;
    location: string;
    startISO: string;
    endISO: string;
};

type TodayStatus = 'not-started' | 'ongoing' | 'break';

type Props = {
    // legacy single shift
    shift?: Shift | null;
    // two-section layout
    todayShift?: Shift | null;
    nextShift?: Shift | null;
    // NEW: scrollable list mode
    upcoming?: Shift[];
    onViewSchedule?: () => void;
    maxListHeight?: number;

    // 🔥 NEW: status for today’s shift
    todayStatus?: TodayStatus;          // 'ongoing' => punched in, 'break' => on break
    todayBreakStartISO?: string | null; // used when status === 'break'
};

export default function NextShiftCard({
    shift,
    todayShift,
    nextShift,
    upcoming,
    onViewSchedule,
    maxListHeight = 260,
    todayStatus = 'not-started',
    todayBreakStartISO = null,
}: Props) {
    const normalizedToday = todayShift ?? null;
    const normalizedNext = (nextShift ?? shift) ?? null;
    const hasToday = Boolean(normalizedToday);
    const hasNext = Boolean(normalizedNext);

    // 🔁 LIST MODE: shifts array + internal scroll
    if (upcoming && upcoming.length > 0) {
        const data = useMemo(
            () =>
                [...upcoming].sort(
                    (a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime()
                ),
            [upcoming]
        );

        return (
            <View style={[styles.card, { flex: 1 }]}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>My Shifts</Text>
                    <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                </View>

                <ScrollView
                    style={{ maxHeight: maxListHeight }}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    contentContainerStyle={{ paddingTop: 8, paddingBottom: 4 }}
                >
                    {data.map((item, index) => (
                        <View key={item.id}>
                            {index > 0 && <View style={styles.sep} />}

                            <View style={styles.item}>
                                <Text style={styles.shiftRole}>
                                    {item.role} • {item.location}
                                </Text>

                                <View style={styles.inlineRow}>
                                    <Ionicons name="calendar-clear-outline" size={14} color={colors.primary} />
                                    <Text style={styles.inlineText}>
                                        {fmtDayDate(item.startISO)} • {fmtTime(item.startISO)} – {fmtTime(item.endISO)}
                                    </Text>
                                    <View style={[styles.pill, { backgroundColor: '#EEF2FF', marginLeft: 'auto' }]}>
                                        <Text style={[styles.pillText, { color: colors.primary }]}>
                                            {getCountdown(item.startISO)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))}

                    <Pressable
                        style={[styles.btnGhost, { alignSelf: 'flex-start', marginTop: 10 }]}
                        onPress={onViewSchedule}
                    >
                        <Text style={styles.btnGhostText}>View full schedule</Text>
                    </Pressable>
                </ScrollView>
            </View>
        );
    }

    // 🧩 FALLBACK: Today + Next sections
    // 👉 compute pill text/colors for TODAY based on status
    let todayPillBg = '#E0F2FE';
    let todayPillTextColor = '#0369A1';
    let todayPillText = '';

    if (normalizedToday) {
        if (todayStatus === 'ongoing') {
            // punched in, on shift
            todayPillBg = '#DCFCE7';
            todayPillTextColor = '#15803D';
            todayPillText = 'Ongoing';
        } else if (todayStatus === 'break') {
            // on break
            todayPillBg = '#FEF3C7';
            todayPillTextColor = '#B45309';
            const start = todayBreakStartISO ?? normalizedToday.startISO;
            todayPillText = `Break from ${fmtTime(start)}`;
        } else {
            // not started yet
            todayPillBg = '#E0F2FE';
            todayPillTextColor = '#0369A1';
            todayPillText = `Starts at ${fmtTime(normalizedToday.startISO)}`;
        }
    }

    return (
        <View style={[styles.card, { flex: 1 }]}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>My Shifts</Text>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            </View>

            {/* Today’s Shift */}
            {hasToday && normalizedToday ? (
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Today’s Shift</Text>
                    <Text style={styles.shiftRole}>
                        {normalizedToday.role} • {normalizedToday.location}
                    </Text>
                    <View style={styles.inlineRow}>
                        <Ionicons name="time-outline" size={14} color={colors.primary} />
                        <Text style={styles.inlineText}>
                            {fmtTime(normalizedToday.startISO)} – {fmtTime(normalizedToday.endISO)}
                        </Text>
                        {!!todayPillText && (
                            <View
                                style={[
                                    styles.pill,
                                    { backgroundColor: todayPillBg, marginLeft: 'auto' },
                                ]}
                            >
                                <Text style={[styles.pillText, { color: todayPillTextColor }]}>
                                    {todayPillText}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            ) : null}

            {/* Next Shift */}
            {hasNext && normalizedNext ? (
                <View style={[styles.section, hasToday && styles.topDivider]}>
                    <Text style={styles.sectionLabel}>Next Shift</Text>
                    <Text style={styles.shiftRole}>
                        {normalizedNext.role} • {normalizedNext.location}
                    </Text>

                    <View style={styles.inlineRow}>
                        <Ionicons name="calendar-clear-outline" size={14} color={colors.primary} />
                        <Text style={styles.inlineText}>
                            {fmtDayDate(normalizedNext.startISO)} • {fmtTime(normalizedNext.startISO)} – {fmtTime(normalizedNext.endISO)}
                        </Text>
                        <View style={[styles.pill, { backgroundColor: '#EEF2FF', marginLeft: 'auto' }]}>
                            <Text style={[styles.pillText, { color: colors.primary }]}>
                                {getCountdown(normalizedNext.startISO)}
                            </Text>
                        </View>
                    </View>

                    <Pressable
                        style={[styles.btnGhost, { alignSelf: 'flex-start', marginTop: 8 }]}
                        onPress={onViewSchedule}
                    >
                        <Text style={styles.btnGhostText}>View schedule</Text>
                    </Pressable>
                </View>
            ) : !hasToday ? (
                <View style={{ paddingVertical: 8 }}>
                    <Text style={styles.muted}>No upcoming shifts.</Text>
                    <Pressable style={[styles.btnGhost, { marginTop: 8 }]}>
                        <Text style={styles.btnGhostText}>Pick up a shift</Text>
                    </Pressable>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.background,
        borderRadius: 14,
        padding: 14,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#00000008',
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },

    section: { marginTop: 10 },
    sectionLabel: { fontSize: 13, color: colors.gray, marginBottom: 4, fontWeight: '600' },
    topDivider: { borderTopWidth: 1, borderTopColor: colors.inputBorder, paddingTop: 10, marginTop: 12 },

    shiftRole: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 2 },

    inlineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
    },
    inlineText: { color: colors.text, fontSize: 13, flexShrink: 1 },

    pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
    pillText: { fontSize: 11, fontWeight: '700' },

    btnGhost: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.inputBorder,
    },
    btnGhostText: { color: colors.text, fontWeight: '700' },
    muted: { color: colors.gray, fontSize: 13 },

    // list-mode styles
    sep: { height: 1, backgroundColor: colors.inputBorder, opacity: 0.7, marginVertical: 8 },
    item: { paddingVertical: 2 },
});
