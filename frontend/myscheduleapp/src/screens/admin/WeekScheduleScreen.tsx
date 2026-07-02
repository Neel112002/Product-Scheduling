// src/screens/admin/WeekScheduleScreen.tsx
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Pressable,
    Alert, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { colors }       from '../../theme/colors';
import { ShiftsAPI }    from '../../api/api';
import { AuthContext }  from '../../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type Employee = { user_id: number; name: string; role?: string | null };
type RoleGroup = { role_id: number | null; role_name: string; employees: Employee[] };

type Row = {
    key:        string;        // local unique key
    user_id:    number | null;
    user_name:  string;
    start_time: string;        // "HH:MM"
    end_time:   string;
    days:       number[];      // 0=Mon ... 6=Sun
};

// roleKey → Row[]
type RowsByRole = Record<string, Row[]>;

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAYS   = [0, 1, 2, 3, 4];   // Mon–Fri default

const HOURS = Array.from({ length: 24 }, (_, i) => {
    const label = new Date(2000, 0, 1, i, 0)
        .toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { value: `${String(i).padStart(2, '0')}:00`, label };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function mondayOf(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();                       // 0=Sun..6=Sat
    const diff = day === 0 ? -6 : 1 - day;        // shift to Monday
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function isoDate(d: Date): string {
    return d.toISOString().split('T')[0];
}

function fmtRange(monday: Date): string {
    const sun = new Date(monday);
    sun.setDate(monday.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${monday.toLocaleDateString('en-CA', opts)} – ${sun.toLocaleDateString('en-CA', opts)}`;
}

function fmtTime(hhmm: string): string {
    const [h] = hhmm.split(':').map(Number);
    const ampm = h < 12 ? 'AM' : 'PM';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${hhmm.split(':')[1]} ${ampm}`;
}

let rowCounter = 0;
function newRow(): Row {
    rowCounter += 1;
    return {
        key:        `row-${Date.now()}-${rowCounter}`,
        user_id:    null,
        user_name:  '',
        start_time: '09:00',
        end_time:   '17:00',
        days:       [...WEEKDAYS],
    };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeekScheduleScreen({ route, navigation }: any) {
    const { user: authUser } = useContext(AuthContext);
    const locationId: number =
        route?.params?.locationId ?? authUser?.primaryLocation?.id ?? 0;

    const [weekOffset,  setWeekOffset]  = useState(0);
    const [roleGroups,  setRoleGroups]  = useState<RoleGroup[]>([]);
    const [rowsByRole,  setRowsByRole]  = useState<RowsByRole>({});
    const [expanded,    setExpanded]    = useState<Record<string, boolean>>({});
    const [loading,     setLoading]     = useState(true);
    const [saving,      setSaving]      = useState(false);

    // Pickers
    const [empPicker,   setEmpPicker]   = useState<{ roleKey: string; row: Row } | null>(null);
    const [timePicker,  setTimePicker]  = useState<{ roleKey: string; rowKey: string; field: 'start_time' | 'end_time' } | null>(null);

    const monday = (() => {
        const d = mondayOf(new Date());
        d.setDate(d.getDate() + weekOffset * 7);
        return d;
    })();

    const roleKeyOf = (g: RoleGroup) => (g.role_id === null ? 'none' : String(g.role_id));

    // ── Fetch roles + staff ─────────────────────────────────────────────────
    const fetchRoles = useCallback(async () => {
        if (!locationId) { setLoading(false); return; }
        try {
            const { data } = await ShiftsAPI.rolesWithStaff(locationId);
            const groups: RoleGroup[] = data?.roles ?? [];
            setRoleGroups(groups);
            // Expand all by default, seed one empty row per role that has employees
            const exp: Record<string, boolean> = {};
            const seed: RowsByRole = {};
            groups.forEach(g => {
                const k = g.role_id === null ? 'none' : String(g.role_id);
                exp[k] = true;
                seed[k] = g.employees.length > 0 ? [newRow()] : [];
            });
            setExpanded(exp);
            setRowsByRole(seed);
        } catch {
            Alert.alert('Error', 'Could not load roles for this location.');
        } finally {
            setLoading(false);
        }
    }, [locationId]);

    useEffect(() => { fetchRoles(); }, [fetchRoles]);

    // ── Row mutations ─────────────────────────────────────────────────────────
    const addRow = (roleKey: string) => {
        setRowsByRole(prev => ({
            ...prev,
            [roleKey]: [...(prev[roleKey] ?? []), newRow()],
        }));
    };

    const removeRow = (roleKey: string, rowKey: string) => {
        setRowsByRole(prev => ({
            ...prev,
            [roleKey]: (prev[roleKey] ?? []).filter(r => r.key !== rowKey),
        }));
    };

    const updateRow = (roleKey: string, rowKey: string, patch: Partial<Row>) => {
        setRowsByRole(prev => ({
            ...prev,
            [roleKey]: (prev[roleKey] ?? []).map(r =>
                r.key === rowKey ? { ...r, ...patch } : r
            ),
        }));
    };

    const toggleDay = (roleKey: string, row: Row, day: number) => {
        const days = row.days.includes(day)
            ? row.days.filter(d => d !== day)
            : [...row.days, day].sort((a, b) => a - b);
        updateRow(roleKey, row.key, { days });
    };

    const setAllDays = (roleKey: string, row: Row) => {
        const all = row.days.length === 7;
        updateRow(roleKey, row.key, { days: all ? [...WEEKDAYS] : [0, 1, 2, 3, 4, 5, 6] });
    };

    // ── Build summary ─────────────────────────────────────────────────────────
    const buildRows = () => {
        const out: any[] = [];
        roleGroups.forEach(g => {
            const k = roleKeyOf(g);
            (rowsByRole[k] ?? []).forEach(r => {
                if (r.user_id && r.days.length > 0) {
                    out.push({
                        role_id:    g.role_id,
                        user_id:    r.user_id,
                        start_time: r.start_time,
                        end_time:   r.end_time,
                        days:       r.days,
                    });
                }
            });
        });
        return out;
    };

    const totalShifts = (() => {
        let n = 0;
        Object.values(rowsByRole).forEach(rows =>
            rows.forEach(r => { if (r.user_id) n += r.days.length; })
        );
        return n;
    })();

    // ── Save ────────────────────────────────────────────────────────────────
    const handleSave = async (publishAfter: boolean) => {
        const rows = buildRows();
        if (rows.length === 0) {
            Alert.alert('Nothing to save', 'Assign at least one employee with days selected.');
            return;
        }
        setSaving(true);
        try {
            const { data } = await ShiftsAPI.bulkWeek({
                location_id: locationId,
                week_start:  isoDate(monday),
                rows,
            });

            const created = data?.created_count ?? 0;
            const skipped = data?.skipped ?? [];

            if (publishAfter && created > 0) {
                try {
                    await ShiftsAPI.publish(locationId, isoDate(monday));
                } catch {}
            }

            let msg = `${created} shift${created === 1 ? '' : 's'} created${publishAfter ? ' and published' : ' as drafts'}.`;
            if (skipped.length > 0) {
                const reasons = skipped.slice(0, 4).map((s: any) =>
                    `• ${s.day ?? 'Row'}: ${s.reason}`
                ).join('\n');
                msg += `\n\n${skipped.length} skipped:\n${reasons}`;
                if (skipped.length > 4) msg += `\n…and ${skipped.length - 4} more`;
            }

            Alert.alert(
                created > 0 ? 'Schedule Saved ✓' : 'Nothing Created',
                msg,
                [{ text: 'OK', onPress: () => { if (created > 0) navigation.goBack(); } }]
            );
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to save schedule.');
        } finally {
            setSaving(false);
        }
    };

    // ── Render a single employee row ───────────────────────────────────────────
    const renderRow = (g: RoleGroup, row: Row) => {
        const roleKey = roleKeyOf(g);
        return (
            <View key={row.key} style={styles.rowCard}>
                {/* Employee selector + delete */}
                <View style={styles.rowTop}>
                    <Pressable
                        style={styles.empSelect}
                        onPress={() => setEmpPicker({ roleKey, row })}
                    >
                        <View style={styles.empAvatar}>
                            <Text style={styles.empAvatarText}>
                                {row.user_name ? row.user_name[0].toUpperCase() : '?'}
                            </Text>
                        </View>
                        <Text style={[styles.empName, !row.user_name && { color: colors.gray }]} numberOfLines={1}>
                            {row.user_name || 'Select employee'}
                        </Text>
                        <Ionicons name="chevron-down" size={15} color={colors.gray} />
                    </Pressable>
                    <Pressable onPress={() => removeRow(roleKey, row.key)} style={styles.rowDelete}>
                        <Ionicons name="trash-outline" size={17} color={colors.error} />
                    </Pressable>
                </View>

                {/* Time selectors */}
                <View style={styles.timeRow}>
                    <Pressable
                        style={styles.timePill}
                        onPress={() => setTimePicker({ roleKey, rowKey: row.key, field: 'start_time' })}
                    >
                        <Ionicons name="time-outline" size={14} color={colors.primary} />
                        <Text style={styles.timePillText}>{fmtTime(row.start_time)}</Text>
                    </Pressable>
                    <Text style={styles.timeDash}>→</Text>
                    <Pressable
                        style={styles.timePill}
                        onPress={() => setTimePicker({ roleKey, rowKey: row.key, field: 'end_time' })}
                    >
                        <Ionicons name="time-outline" size={14} color={colors.primary} />
                        <Text style={styles.timePillText}>{fmtTime(row.end_time)}</Text>
                    </Pressable>
                </View>

                {/* Day toggles */}
                <View style={styles.daysRow}>
                    {DAY_LABELS.map((label, i) => {
                        const on = row.days.includes(i);
                        return (
                            <Pressable
                                key={i}
                                style={[styles.dayChip, on && styles.dayChipOn]}
                                onPress={() => toggleDay(roleKey, row, i)}
                            >
                                <Text style={[styles.dayChipText, on && styles.dayChipTextOn]}>
                                    {label}
                                </Text>
                            </Pressable>
                        );
                    })}
                    <Pressable style={styles.allBtn} onPress={() => setAllDays(roleKey, row)}>
                        <Text style={styles.allBtnText}>
                            {row.days.length === 7 ? 'M–F' : 'All'}
                        </Text>
                    </Pressable>
                </View>

                {/* Per-row summary */}
                {row.user_id && row.days.length > 0 && (
                    <Text style={styles.rowSummary}>
                        {row.days.length} shift{row.days.length === 1 ? '' : 's'} · {row.days.map(d => DAY_LABELS[d]).join(' ')}
                    </Text>
                )}
            </View>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Week Schedule</Text>
            </View>

            {/* Week selector */}
            <View style={styles.weekBar}>
                <Pressable
                    style={styles.weekArrow}
                    onPress={() => setWeekOffset(w => w - 1)}
                >
                    <Ionicons name="chevron-back" size={20} color={colors.primary} />
                </Pressable>
                <View style={styles.weekCenter}>
                    <Text style={styles.weekRange}>{fmtRange(monday)}</Text>
                    <Text style={styles.weekHint}>
                        {weekOffset === 0 ? 'This week' : weekOffset === 1 ? 'Next week' : weekOffset === -1 ? 'Last week' : `${weekOffset > 0 ? '+' : ''}${weekOffset} weeks`}
                    </Text>
                </View>
                <Pressable
                    style={styles.weekArrow}
                    onPress={() => setWeekOffset(w => w + 1)}
                >
                    <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Info banner */}
                    <View style={styles.banner}>
                        <Ionicons name="information-circle-outline" size={15} color={colors.primary} />
                        <Text style={styles.bannerText}>
                            Assign employees under each role. Pick their hours and the days they work that week. Conflicts are checked automatically.
                        </Text>
                    </View>

                    {roleGroups.length === 0 ? (
                        <View style={styles.empty}>
                            <Ionicons name="people-outline" size={40} color={colors.inputBorder} />
                            <Text style={styles.emptyTitle}>No roles found</Text>
                            <Text style={styles.emptySub}>Create roles in Team & Roles first.</Text>
                        </View>
                    ) : (
                        roleGroups.map(g => {
                            const k        = roleKeyOf(g);
                            const isOpen   = expanded[k];
                            const rows     = rowsByRole[k] ?? [];
                            const hasStaff = g.employees.length > 0;
                            return (
                                <View key={k} style={styles.roleCard}>
                                    <Pressable
                                        style={styles.roleHeader}
                                        onPress={() => setExpanded(e => ({ ...e, [k]: !e[k] }))}
                                    >
                                        <View style={styles.roleHeaderLeft}>
                                            <View style={styles.roleIcon}>
                                                <Ionicons name="briefcase-outline" size={16} color={colors.primary} />
                                            </View>
                                            <View>
                                                <Text style={styles.roleName}>{g.role_name}</Text>
                                                <Text style={styles.roleCount}>
                                                    {g.employees.length} employee{g.employees.length === 1 ? '' : 's'}
                                                    {rows.filter(r => r.user_id).length > 0 &&
                                                        ` · ${rows.filter(r => r.user_id).length} assigned`}
                                                </Text>
                                            </View>
                                        </View>
                                        <Ionicons
                                            name={isOpen ? 'chevron-up' : 'chevron-down'}
                                            size={18}
                                            color={colors.gray}
                                        />
                                    </Pressable>

                                    {isOpen && (
                                        <View style={styles.roleBody}>
                                            {!hasStaff ? (
                                                <Text style={styles.noStaffText}>
                                                    No employees in this role.
                                                </Text>
                                            ) : (
                                                <>
                                                    {rows.map(row => renderRow(g, row))}
                                                    <Pressable
                                                        style={styles.addRowBtn}
                                                        onPress={() => addRow(k)}
                                                    >
                                                        <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                                                        <Text style={styles.addRowText}>Add employee</Text>
                                                    </Pressable>
                                                </>
                                            )}
                                        </View>
                                    )}
                                </View>
                            );
                        })
                    )}

                    <View style={{ height: 140 }} />
                </ScrollView>
            )}

            {/* Footer */}
            {!loading && roleGroups.length > 0 && (
                <View style={styles.footer}>
                    {totalShifts > 0 && (
                        <Text style={styles.footerSummary}>
                            {totalShifts} shift{totalShifts === 1 ? '' : 's'} will be created
                        </Text>
                    )}
                    <View style={styles.footerBtns}>
                        <Pressable
                            style={[styles.draftBtn, saving && { opacity: 0.6 }]}
                            onPress={() => handleSave(false)}
                            disabled={saving}
                        >
                            {saving
                                ? <ActivityIndicator size="small" color={colors.primary} />
                                : <Text style={styles.draftBtnText}>Save as Draft</Text>
                            }
                        </Pressable>
                        <Pressable
                            style={[styles.publishBtn, saving && { opacity: 0.6 }]}
                            onPress={() => handleSave(true)}
                            disabled={saving}
                        >
                            {saving
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <>
                                    <Ionicons name="checkmark-done" size={18} color="#fff" />
                                    <Text style={styles.publishBtnText}>Save & Publish</Text>
                                </>
                            }
                        </Pressable>
                    </View>
                </View>
            )}

            {/* Employee picker modal */}
            <Modal
                visible={!!empPicker}
                transparent
                animationType="slide"
                onRequestClose={() => setEmpPicker(null)}
            >
                <Pressable style={styles.overlay} onPress={() => setEmpPicker(null)}>
                    <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>Select Employee</Text>
                        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                            {empPicker && (() => {
                                const group = roleGroups.find(g => roleKeyOf(g) === empPicker.roleKey);
                                return (group?.employees ?? []).map(emp => {
                                    const selected = empPicker.row.user_id === emp.user_id;
                                    return (
                                        <Pressable
                                            key={emp.user_id}
                                            style={[styles.empRow, selected && styles.empRowSelected]}
                                            onPress={() => {
                                                updateRow(empPicker.roleKey, empPicker.row.key, {
                                                    user_id:   emp.user_id,
                                                    user_name: emp.name,
                                                });
                                                setEmpPicker(null);
                                            }}
                                        >
                                            <View style={styles.empRowAvatar}>
                                                <Text style={styles.empRowAvatarText}>
                                                    {emp.name[0].toUpperCase()}
                                                </Text>
                                            </View>
                                            <Text style={styles.empRowName}>{emp.name}</Text>
                                            {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                                        </Pressable>
                                    );
                                });
                            })()}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Time picker modal */}
            <Modal
                visible={!!timePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setTimePicker(null)}
            >
                <Pressable style={styles.overlay} onPress={() => setTimePicker(null)}>
                    <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>
                            {timePicker?.field === 'start_time' ? 'Start Time' : 'End Time'}
                        </Text>
                        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                            {HOURS.map(h => {
                                const current = timePicker
                                    ? (rowsByRole[timePicker.roleKey] ?? []).find(r => r.key === timePicker.rowKey)?.[timePicker.field]
                                    : null;
                                const sel = current === h.value;
                                return (
                                    <Pressable
                                        key={h.value}
                                        style={[styles.timeOption, sel && styles.timeOptionActive]}
                                        onPress={() => {
                                            if (timePicker) {
                                                updateRow(timePicker.roleKey, timePicker.rowKey, {
                                                    [timePicker.field]: h.value,
                                                } as Partial<Row>);
                                            }
                                            setTimePicker(null);
                                        }}
                                    >
                                        <Text style={[styles.timeOptionText, sel && styles.timeOptionTextActive]}>
                                            {h.label}
                                        </Text>
                                        {sel && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:             { flex: 1, backgroundColor: '#F8F8FC' },
    scroll:           { flex: 1 },
    content:          { padding: 16 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    backBtn:     { padding: 4, marginRight: 8 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },

    weekBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    weekArrow: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: colors.subtleAccent,
        alignItems: 'center', justifyContent: 'center',
    },
    weekCenter: { alignItems: 'center' },
    weekRange:  { fontSize: 15, fontWeight: '700', color: colors.text },
    weekHint:   { fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 1 },

    banner: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        backgroundColor: colors.subtleAccent, borderRadius: 10,
        padding: 12, marginBottom: 14,
        borderWidth: 1, borderColor: colors.primary + '20',
    },
    bannerText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 18 },

    empty:      { alignItems: 'center', paddingVertical: 50, gap: 8 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    emptySub:   { fontSize: 13, color: colors.gray, textAlign: 'center' },

    // Role group card
    roleCard: {
        backgroundColor: '#fff', borderRadius: 14, marginBottom: 12,
        borderWidth: 1, borderColor: '#EFEFEF', overflow: 'hidden',
    },
    roleHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 14,
    },
    roleHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    roleIcon: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: colors.primary + '15',
        alignItems: 'center', justifyContent: 'center',
    },
    roleName:  { fontSize: 15, fontWeight: '700', color: colors.text },
    roleCount: { fontSize: 11, color: colors.gray, marginTop: 1 },

    roleBody: {
        paddingHorizontal: 14, paddingBottom: 14, gap: 10,
        borderTopWidth: 1, borderTopColor: '#F5F5F5',
    },
    noStaffText: { fontSize: 13, color: colors.gray, fontStyle: 'italic', paddingTop: 10 },

    // Employee row card
    rowCard: {
        backgroundColor: '#FAFAFC', borderRadius: 12, padding: 12,
        borderWidth: 1, borderColor: '#EFEFEF', gap: 10, marginTop: 10,
    },
    rowTop:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
    empSelect: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#fff', borderRadius: 10,
        paddingHorizontal: 10, paddingVertical: 8,
        borderWidth: 1, borderColor: colors.inputBorder,
    },
    empAvatar: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: colors.primary + '20',
        alignItems: 'center', justifyContent: 'center',
    },
    empAvatarText: { fontSize: 13, fontWeight: '700', color: colors.primary },
    empName:       { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
    rowDelete: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: colors.error + '10',
        alignItems: 'center', justifyContent: 'center',
    },

    timeRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
    timePill: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: '#fff', borderRadius: 10, paddingVertical: 9,
        borderWidth: 1, borderColor: colors.inputBorder,
    },
    timePillText: { fontSize: 13, fontWeight: '600', color: colors.text },
    timeDash:     { fontSize: 14, color: colors.gray },

    daysRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
    dayChip: {
        width: 32, height: 32, borderRadius: 8,
        backgroundColor: '#fff', borderWidth: 1, borderColor: colors.inputBorder,
        alignItems: 'center', justifyContent: 'center',
    },
    dayChipOn:      { backgroundColor: colors.primary, borderColor: colors.primary },
    dayChipText:    { fontSize: 12, fontWeight: '700', color: colors.gray },
    dayChipTextOn:  { color: '#fff' },
    allBtn: {
        paddingHorizontal: 10, height: 32, borderRadius: 8,
        backgroundColor: colors.subtleAccent,
        alignItems: 'center', justifyContent: 'center',
        marginLeft: 'auto',
    },
    allBtnText: { fontSize: 11, fontWeight: '700', color: colors.primary },

    rowSummary: { fontSize: 11, color: colors.primary, fontWeight: '600' },

    addRowBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 10, borderRadius: 10,
        borderWidth: 1.5, borderColor: colors.primary + '40', borderStyle: 'dashed',
    },
    addRowText: { fontSize: 13, fontWeight: '600', color: colors.primary },

    // Footer
    footer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0',
        padding: 16, paddingBottom: 28, gap: 10,
    },
    footerSummary: { fontSize: 12, color: colors.gray, textAlign: 'center', fontWeight: '600' },
    footerBtns:    { flexDirection: 'row', gap: 10 },
    draftBtn: {
        flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13,
        borderRadius: 999, borderWidth: 1.5, borderColor: colors.primary,
    },
    draftBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
    publishBtn: {
        flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 13, borderRadius: 999, backgroundColor: colors.primary,
    },
    publishBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

    // Modals
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 20, paddingBottom: 36, maxHeight: '70%',
    },
    sheetHandle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 16,
    },
    sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 14 },

    empRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 11, paddingHorizontal: 8, borderRadius: 10,
        borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
    },
    empRowSelected:  { backgroundColor: colors.subtleAccent },
    empRowAvatar: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.primary + '20',
        alignItems: 'center', justifyContent: 'center',
    },
    empRowAvatarText: { fontSize: 14, fontWeight: '700', color: colors.primary },
    empRowName:       { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },

    timeOption: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 12, paddingHorizontal: 16,
        borderBottomWidth: 1, borderBottomColor: '#F5F5F5', borderRadius: 8,
    },
    timeOptionActive:     { backgroundColor: colors.subtleAccent },
    timeOptionText:       { fontSize: 14, color: colors.text },
    timeOptionTextActive: { color: colors.primary, fontWeight: '700' },
});