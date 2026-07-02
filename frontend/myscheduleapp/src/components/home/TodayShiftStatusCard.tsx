// src/components/home/TodayShiftStatusCard.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors }   from '../../theme/colors';

// ── Types ─────────────────────────────────────────────────────────────────────

type BreakEntry = {
    break_id:          number;
    break_start:       string;
    break_end?:        string | null;
    duration_minutes?: number | null;
    is_active:         boolean;
};

type ActiveEntry = {
    entry_id:       number;
    shift_id?:      number | null;
    clock_in:       string;
    clock_out?:     string | null;
    total_minutes?: number | null;
    live_minutes:   number;
    is_active:      boolean;
    is_on_break:    boolean;
    breaks:         BreakEntry[];
    break_count:    number;
};

type TodayShift = {
    shift_id:   number;
    role?:      string | null;
    start_time: string;
    end_time:   string;
    location?:  string | null;
};

type ClockSettings = { break_duration_mins: number };

export type ShiftStatusProps = {
    todayShift:  TodayShift | null;
    activeEntry: ActiveEntry | null;
    settings:    ClockSettings | null;
    onClockIn:   () => void;
    onClockOut:  () => void;
    onBreak:     () => void;
    onTimesheet: () => void;
};

type ShiftStatus =
    | 'no_shift'
    | 'yet_to_start'
    | 'window_open'
    | 'late'
    | 'missed'
    | 'working'
    | 'on_break'
    | 'shift_ended';

// ── Constants ─────────────────────────────────────────────────────────────────

const CLOCK_WINDOW_MINS = 15; // must match backend timedelta(minutes=15)

// ── Day/Night helper ──────────────────────────────────────────────────────────

function getDayNightIcon(): {
    icon:  React.ComponentProps<typeof Ionicons>['name'];
    color: string;
} {
    const hour  = new Date().getHours();
    const isDay = hour >= 6 && hour < 20;
    return isDay
        ? { icon: 'sunny-outline', color: '#F59E0B' }
        : { icon: 'moon-outline',  color: '#6366F1' };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-CA', {
        hour:   '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
    return `${m}m`;
}

function getCountdown(targetIso: string): string {
    const diff = new Date(targetIso).getTime() - Date.now();
    if (diff <= 0) return '';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m} min`;
}

function getMinsLate(startIso: string): number {
    return Math.floor((Date.now() - new Date(startIso).getTime()) / 60000);
}

function getLiveMinutes(clockInIso: string): number {
    return Math.floor((Date.now() - new Date(clockInIso).getTime()) / 60000);
}

function getBreakElapsed(breakStartIso: string): number {
    return Math.floor((Date.now() - new Date(breakStartIso).getTime()) / 60000);
}

function getBreakExpectedEnd(breakStartIso: string, durationMins: number): string {
    const end = new Date(new Date(breakStartIso).getTime() + durationMins * 60000);
    return formatTime(end.toISOString());
}

function calcStatus(
    todayShift:  TodayShift | null,
    activeEntry: ActiveEntry | null,
    now:         Date,
): ShiftStatus {
    if (!todayShift) return 'no_shift';

    const start       = new Date(todayShift.start_time);
    const end         = new Date(todayShift.end_time);
    const windowOpen  = new Date(start.getTime() - CLOCK_WINDOW_MINS * 60000);
    const windowClose = new Date(start.getTime() + CLOCK_WINDOW_MINS * 60000);
    const lateAt      = new Date(start.getTime() + 5 * 60000);

    // Already clocked in
    if (activeEntry?.is_active) {
        if (activeEntry.is_on_break) return 'on_break';
        return 'working';
    }

    // Shift has ended
    if (now > end) {
        // If they never clocked in → missed
        return activeEntry ? 'shift_ended' : 'missed';
    }

    // Clock-in window has closed (past start + 15 min) — too late to self-clock-in
    if (now > windowClose) return 'late';

    // Within ±15 min window
    if (now >= windowOpen) return 'window_open';

    // Upcoming but close (show late-ish warning after shift start + 5min)
    if (now >= lateAt) return 'late';

    return 'yet_to_start';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TodayShiftStatusCard({
    todayShift,
    activeEntry,
    settings,
    onClockIn,
    onClockOut,
    onBreak,
    onTimesheet,
}: ShiftStatusProps) {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 30_000);
        return () => clearInterval(interval);
    }, []);

    const status = useMemo(
        () => calcStatus(todayShift, activeEntry, now),
        [todayShift, activeEntry, now]
    );

    const activeBreak = activeEntry?.breaks?.find(b => b.is_active) ?? null;
    const dayNight    = getDayNightIcon();

    // ── No shift ──────────────────────────────────────────────────────────────
    if (status === 'no_shift') {
        return (
            <View style={[styles.card, styles.cardNeutral]}>
                <View style={[styles.iconWrap, { backgroundColor: dayNight.color + '20' }]}>
                    <Ionicons name={dayNight.icon} size={22} color={dayNight.color} />
                </View>
                <View style={styles.textCol}>
                    <Text style={styles.statusTitle}>No shift today</Text>
                    <Text style={styles.statusSub}>Enjoy your day off</Text>
                </View>
            </View>
        );
    }

    // ── Yet to start ──────────────────────────────────────────────────────────
    if (status === 'yet_to_start') {
        const countdown = getCountdown(todayShift!.start_time);
        return (
            <View style={[styles.card, styles.cardBlue]}>
                <View style={[styles.iconWrap, { backgroundColor: '#6366F120' }]}>
                    <Ionicons name="time-outline" size={22} color="#6366F1" />
                </View>
                <View style={styles.textCol}>
                    <Text style={[styles.statusTitle, { color: '#6366F1' }]}>
                        Yet to start
                    </Text>
                    <Text style={styles.statusSub}>
                        {formatTime(todayShift!.start_time)} – {formatTime(todayShift!.end_time)}
                    </Text>
                    {countdown ? (
                        <Text style={[styles.countdown, { color: '#6366F1' }]}>
                            Starts in {countdown}
                        </Text>
                    ) : null}
                </View>
            </View>
        );
    }

    // ── Window open ───────────────────────────────────────────────────────────
    if (status === 'window_open') {
        return (
            <View style={[styles.card, styles.cardSuccess]}>
                <View style={[styles.iconWrap, { backgroundColor: colors.success + '20' }]}>
                    <Ionicons name="log-in-outline" size={22} color={colors.success} />
                </View>
                <View style={styles.textCol}>
                    <Text style={[styles.statusTitle, { color: colors.success }]}>
                        Ready to clock in
                    </Text>
                    <Text style={styles.statusSub}>
                        {formatTime(todayShift!.start_time)} – {formatTime(todayShift!.end_time)}
                    </Text>
                    <Text style={[styles.statusSub, { color: colors.success, marginTop: 2 }]}>
                        Window closes in {getCountdown(
                            new Date(new Date(todayShift!.start_time).getTime() + CLOCK_WINDOW_MINS * 60000).toISOString()
                        ) || 'soon'}
                    </Text>
                </View>
                <Pressable
                    style={[styles.actionBtn, { backgroundColor: colors.success }]}
                    onPress={onClockIn}
                >
                    <Text style={styles.actionBtnText}>Clock In</Text>
                </Pressable>
            </View>
        );
    }

    // ── Late — window passed, manager must clock in ───────────────────────────
    if (status === 'late') {
        const minsLate = getMinsLate(todayShift!.start_time);
        return (
            <View style={[styles.card, styles.cardError]}>
                <View style={[styles.iconWrap, { backgroundColor: colors.error + '20' }]}>
                    <Ionicons name="alert-circle-outline" size={22} color={colors.error} />
                </View>
                <View style={styles.textCol}>
                    <Text style={[styles.statusTitle, { color: colors.error }]}>
                        Clock-in window closed
                    </Text>
                    <Text style={[styles.statusSub, { color: colors.error + 'BB' }]}>
                        {minsLate} min late · shift started {formatTime(todayShift!.start_time)}
                    </Text>
                    <Text style={[styles.statusSub, { marginTop: 4, fontWeight: '600' }]}>
                        Contact your manager to clock you in
                    </Text>
                </View>
                {/* Disabled red button — no onPress */}
                <View style={[styles.actionBtn, styles.actionBtnDisabled]}>
                    <Ionicons name="lock-closed-outline" size={14} color="#fff" />
                    <Text style={styles.actionBtnText}>Locked</Text>
                </View>
            </View>
        );
    }

    // ── Missed — shift ended, never clocked in ────────────────────────────────
    if (status === 'missed') {
        return (
            <View style={[styles.card, styles.cardError]}>
                <View style={[styles.iconWrap, { backgroundColor: colors.error + '20' }]}>
                    <Ionicons name="close-circle-outline" size={22} color={colors.error} />
                </View>
                <View style={styles.textCol}>
                    <Text style={[styles.statusTitle, { color: colors.error }]}>
                        Shift missed
                    </Text>
                    <Text style={[styles.statusSub, { color: colors.error + 'BB' }]}>
                        {formatTime(todayShift!.start_time)} – {formatTime(todayShift!.end_time)}
                    </Text>
                    <Text style={[styles.statusSub, { marginTop: 4, fontWeight: '600' }]}>
                        Contact your manager if this is an error
                    </Text>
                </View>
            </View>
        );
    }

    // ── Working ───────────────────────────────────────────────────────────────
    if (status === 'working' && activeEntry) {
        const liveMinutes = getLiveMinutes(activeEntry.clock_in);
        return (
            <View style={[styles.card, styles.cardSuccess]}>
                <View style={[styles.iconWrap, { backgroundColor: colors.success + '20' }]}>
                    <Ionicons name="checkmark-circle-outline" size={22} color={colors.success} />
                </View>
                <View style={styles.textCol}>
                    <Text style={[styles.statusTitle, { color: colors.success }]}>
                        On shift
                    </Text>
                    <Text style={styles.statusSub}>
                        {formatDuration(liveMinutes)} · clocked in {formatTime(activeEntry.clock_in)}
                    </Text>
                    <Text style={[styles.statusSub, { marginTop: 2 }]}>
                        Ends {formatTime(todayShift!.end_time)}
                    </Text>
                </View>
                <View style={styles.btnCol}>
                    <Pressable
                        style={[styles.actionBtnSmall, { borderColor: colors.warning }]}
                        onPress={onBreak}
                    >
                        <Text style={[styles.actionBtnSmallText, { color: colors.warning }]}>
                            Break
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.actionBtnSmall, { borderColor: colors.error }]}
                        onPress={onClockOut}
                    >
                        <Text style={[styles.actionBtnSmallText, { color: colors.error }]}>
                            Out
                        </Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    // ── On break ──────────────────────────────────────────────────────────────
    if (status === 'on_break' && activeEntry && activeBreak) {
        const breakMins   = getBreakElapsed(activeBreak.break_start);
        const expectedEnd = getBreakExpectedEnd(
            activeBreak.break_start,
            settings?.break_duration_mins ?? 30
        );
        const isOverBreak = breakMins > (settings?.break_duration_mins ?? 30);
        const liveMinutes = getLiveMinutes(activeEntry.clock_in);

        return (
            <View style={[styles.card, styles.cardWarning]}>
                <View style={[styles.iconWrap, { backgroundColor: colors.warning + '20' }]}>
                    <Ionicons name="cafe-outline" size={22} color={colors.warning} />
                </View>
                <View style={styles.textCol}>
                    <Text style={[styles.statusTitle, { color: colors.warning }]}>
                        On break {isOverBreak ? '· Overdue!' : ''}
                    </Text>
                    <Text style={styles.statusSub}>
                        Started {formatTime(activeBreak.break_start)}
                        {'  ·  '}{formatDuration(breakMins)} elapsed
                    </Text>
                    <Text style={[
                        styles.statusSub,
                        { color: isOverBreak ? colors.error : colors.gray, marginTop: 2 },
                    ]}>
                        Expected back {expectedEnd}
                    </Text>
                    <Text style={[styles.statusSub, { marginTop: 2 }]}>
                        Total worked: {formatDuration(liveMinutes - breakMins)}
                    </Text>
                </View>
                <Pressable
                    style={[styles.actionBtn, { backgroundColor: colors.warning }]}
                    onPress={onBreak}
                >
                    <Text style={styles.actionBtnText}>End Break</Text>
                </Pressable>
            </View>
        );
    }

    // ── Shift ended (clocked out successfully) ────────────────────────────────
    if (status === 'shift_ended') {
        const workedMins = activeEntry?.total_minutes ?? null;
        return (
            <View style={[styles.card, styles.cardNeutral]}>
                <View style={[styles.iconWrap, { backgroundColor: colors.success + '15' }]}>
                    <Ionicons name="checkmark-done-outline" size={22} color={colors.success} />
                </View>
                <View style={styles.textCol}>
                    <Text style={[styles.statusTitle, { color: colors.success }]}>
                        Shift ended
                    </Text>
                    {workedMins !== null && (
                        <Text style={styles.statusSub}>
                            Worked {formatDuration(workedMins)} today
                        </Text>
                    )}
                    <Pressable onPress={onTimesheet}>
                        <Text style={[
                            styles.statusSub,
                            { color: colors.primary, fontWeight: '600', marginTop: 4 },
                        ]}>
                            View timesheet →
                        </Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    return null;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems:    'center',
        borderRadius:  14,
        padding:       12,
        borderWidth:   1,
        gap:           10,
        marginBottom:  8,
    },
    cardNeutral: { backgroundColor: '#F9FAFB',              borderColor: '#EFEFEF'              },
    cardBlue:    { backgroundColor: '#6366F108',            borderColor: '#6366F130'            },
    cardSuccess: { backgroundColor: colors.success + '08',  borderColor: colors.success + '30' },
    cardWarning: { backgroundColor: colors.warning + '08',  borderColor: colors.warning + '30' },
    cardError:   { backgroundColor: colors.error   + '08',  borderColor: colors.error   + '30' },

    iconWrap: {
        width:          42,
        height:         42,
        borderRadius:   21,
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
    },
    textCol:     { flex: 1, minWidth: 0 },
    statusTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
    statusSub:   { fontSize: 11, color: colors.gray, marginTop: 2 },
    countdown:   { fontSize: 12, fontWeight: '700', marginTop: 4 },

    actionBtn: {
        flexDirection:     'row',
        alignItems:        'center',
        gap:               4,
        paddingHorizontal: 14,
        paddingVertical:    8,
        borderRadius:      999,
        flexShrink:        0,
    },
    actionBtnDisabled: {
        backgroundColor: colors.error,
        opacity:         0.5,
    },
    actionBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

    btnCol: { gap: 6, flexShrink: 0 },
    actionBtnSmall: {
        paddingHorizontal: 12,
        paddingVertical:    6,
        borderRadius:      999,
        borderWidth:       1.5,
        alignItems:        'center',
    },
    actionBtnSmallText: { fontSize: 11, fontWeight: '700' },
});