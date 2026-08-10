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
import ShiftRing, { RingTone } from './ShiftRing';

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

// ── Helpers (unchanged from the original) ──────────────────────────────────────

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

// ── New helper — how far through the scheduled shift are we, 0 to 1 ───────────
function getElapsedProgress(startIso: string, endIso: string, nowMs: number): number {
    const start = new Date(startIso).getTime();
    const end   = new Date(endIso).getTime();
    if (end <= start) return 0;
    return Math.min(Math.max((nowMs - start) / (end - start), 0), 1);
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

    // ── No shift — kept as a simple flat card, there's no timeline to ring ─────
    if (status === 'no_shift') {
        return (
            <View style={[styles.flatCard, styles.cardNeutral]}>
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

    // ── Every other state renders through the ring ──────────────────────────────
    let ringProps: {
        tone: RingTone;
        progress: number;
        pulsing?: boolean;
        icon: React.ComponentProps<typeof Ionicons>['name'];
        label: string;
        primaryText: string;
        secondaryText?: string;
        actionLabel?: string;
        actionIcon?: React.ComponentProps<typeof Ionicons>['name'];
        onAction?: () => void;
        actionDisabled?: boolean;
    } | null = null;

    let secondaryAction: { label: string; onPress: () => void } | null = null;

    if (status === 'yet_to_start') {
        const countdown = getCountdown(todayShift!.start_time);
        ringProps = {
            tone: 'info',
            progress: 0,
            icon: 'time-outline',
            label: countdown ? `starts in ${countdown}` : 'shift scheduled',
            primaryText: `${formatTime(todayShift!.start_time)} – ${formatTime(todayShift!.end_time)}`,
        };
    }

    if (status === 'window_open') {
        const closesIn = getCountdown(
            new Date(new Date(todayShift!.start_time).getTime() + CLOCK_WINDOW_MINS * 60000).toISOString()
        );
        ringProps = {
            tone: 'success',
            progress: 0,
            pulsing: true,
            icon: 'log-in-outline',
            label: 'ready to clock in',
            primaryText: `${formatTime(todayShift!.start_time)} – ${formatTime(todayShift!.end_time)}`,
            secondaryText: `window closes in ${closesIn || 'soon'}`,
            actionLabel: 'Clock In',
            actionIcon: 'log-in-outline',
            onAction: onClockIn,
        };
    }

    if (status === 'late') {
        const minsLate = getMinsLate(todayShift!.start_time);
        ringProps = {
            tone: 'danger',
            progress: getElapsedProgress(todayShift!.start_time, todayShift!.end_time, now.getTime()),
            icon: 'alert-circle-outline',
            label: `${minsLate} min late`,
            primaryText: `${formatTime(todayShift!.start_time)} – ${formatTime(todayShift!.end_time)}`,
            secondaryText: 'contact your manager',
            actionLabel: 'Locked',
            actionIcon: 'lock-closed-outline',
            actionDisabled: true,
        };
    }

    if (status === 'missed') {
        ringProps = {
            tone: 'danger',
            progress: 1,
            icon: 'close-circle-outline',
            label: 'shift missed',
            primaryText: `${formatTime(todayShift!.start_time)} – ${formatTime(todayShift!.end_time)}`,
            secondaryText: 'contact your manager',
        };
    }

    if (status === 'working' && activeEntry) {
        const liveMinutes = getLiveMinutes(activeEntry.clock_in);
        ringProps = {
            tone: 'success',
            progress: getElapsedProgress(todayShift!.start_time, todayShift!.end_time, now.getTime()),
            icon: 'checkmark-circle-outline',
            label: 'on shift',
            primaryText: formatDuration(liveMinutes),
            secondaryText: `ends ${formatTime(todayShift!.end_time)}`,
            actionLabel: 'Clock Out',
            actionIcon: 'log-out-outline',
            onAction: onClockOut,
        };
        secondaryAction = { label: 'Take a break', onPress: onBreak };
    }

    if (status === 'on_break' && activeEntry && activeBreak) {
        const breakMins    = getBreakElapsed(activeBreak.break_start);
        const expectedEnd  = getBreakExpectedEnd(activeBreak.break_start, settings?.break_duration_mins ?? 30);
        const isOverBreak  = breakMins > (settings?.break_duration_mins ?? 30);
        ringProps = {
            tone: isOverBreak ? 'danger' : 'warning',
            progress: getElapsedProgress(todayShift!.start_time, todayShift!.end_time, now.getTime()),
            icon: 'cafe-outline',
            label: isOverBreak ? 'on break · overdue' : 'on break',
            primaryText: formatDuration(breakMins),
            secondaryText: `back by ${expectedEnd}`,
            actionLabel: 'End Break',
            actionIcon: 'play-outline',
            onAction: onBreak,
        };
    }

    if (status === 'shift_ended') {
        const workedMins = activeEntry?.total_minutes ?? null;
        ringProps = {
            tone: 'success',
            progress: 1,
            icon: 'checkmark-done-outline',
            label: 'shift complete',
            primaryText: workedMins !== null ? formatDuration(workedMins) : 'shift complete',
            secondaryText: `${formatTime(todayShift!.start_time)} – ${formatTime(todayShift!.end_time)}`,
            actionLabel: 'View Timesheet',
            actionIcon: 'document-text-outline',
            onAction: onTimesheet,
        };
    }

    if (!ringProps) return null;

    return (
        <View style={styles.ringCard}>
            <ShiftRing size={160} strokeWidth={12} {...ringProps} />
            {secondaryAction && (
                <Pressable onPress={secondaryAction.onPress} style={styles.secondaryLink} hitSlop={8}>
                    <Ionicons name="cafe-outline" size={14} color={colors.warning} />
                    <Text style={styles.secondaryLinkText}>{secondaryAction.label}</Text>
                </Pressable>
            )}
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    // Flat card — only used for the "no shift today" state
    flatCard: {
        flexDirection: 'row',
        alignItems:    'center',
        borderRadius:  14,
        padding:       12,
        borderWidth:   1,
        gap:           10,
        marginBottom:  8,
    },
    cardNeutral: { backgroundColor: '#F9FAFB', borderColor: '#EFEFEF' },

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

    // Ring card — used for every other state
    ringCard: {
        backgroundColor: '#fff',
        borderRadius:    16,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        paddingVertical: 22,
        paddingHorizontal: 16,
        alignItems:      'center',
        marginBottom:    8,
    },
    secondaryLink: {
        flexDirection: 'row',
        alignItems:    'center',
        gap:           6,
        marginTop:     14,
        paddingVertical: 4,
    },
    secondaryLinkText: { fontSize: 13, fontWeight: '600', color: colors.warning },
});