// src/screens/admin/AdminDashboardScreen.tsx
import React, { useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
} from 'react-native';
import { SafeAreaView }        from 'react-native-safe-area-context';
import { Ionicons }            from '@expo/vector-icons';
import { colors }              from '../../theme/colors';
import { AuthContext }         from '../../context/AuthContext';
import { useNotifications }    from '../../hooks/useNotifications';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tile = {
    icon:        React.ComponentProps<typeof Ionicons>['name'];
    label:       string;
    description: string;
    color:       string;
    onPress:     () => void;
    badge?:      string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminDashboardScreen({ navigation }: any) {
    const { logout, user }   = useContext(AuthContext);
    const { unreadCount }    = useNotifications();

    const roleName    = user?.role?.name  ?? 'Manager';
    const displayName = user?.display_name || user?.username || 'Admin';
    const initials    = displayName
        .trim()
        .split(/\s+/)
        .map((p: string) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    const tiles: Tile[] = [
        {
            icon:        'calendar-outline',
            label:       'Schedule',
            description: 'Create, edit and publish weekly shifts.',
            color:       colors.primary,
            badge:       'Core',
            onPress:     () => navigation.navigate('Schedule', {}),
        },
        {
            icon:        'people-outline',
            label:       'Team & Roles',
            description: 'Manage staff, permissions and invites.',
            color:       '#10B981',
            onPress:     () => navigation.navigate('TeamRoles'),
        },
        {
            icon:        'person-add-outline',
            label:       'Invite Staff',
            description: 'Send onboarding invites to new employees.',
            color:       '#F59E0B',
            onPress:     () => navigation.navigate('InviteStaff'),
        },
        {
            icon:        'business-outline',
            label:       'Locations',
            description: 'Configure stores and opening hours.',
            color:       '#6366F1',
            onPress:     () => {},
        },
        {
            icon:        'stats-chart-outline',
            label:       'Analytics',
            description: 'Track hours, labor cost and overtime.',
            color:       '#EF4444',
            onPress:     () => {},
        },
        {
            icon:        'sparkles-outline',
            label:       'AI Assistant',
            description: 'Auto-generate schedules with AI.',
            color:       '#8B5CF6',
            badge:       'Advanced',
            onPress:     () => {},
        },
    ];

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Header ── */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{initials}</Text>
                        </View>
                        <View>
                            <Text style={styles.greeting}>Good day,</Text>
                            <Text style={styles.name}>{displayName}</Text>
                            <View style={styles.rolePill}>
                                <Text style={styles.roleText}>{roleName}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Right side — notification bell + logout */}
                    <View style={styles.headerRight}>

                        {/* Notification bell with badge */}
                        <Pressable
                            onPress={() => navigation.navigate('Notifications')}
                            style={styles.iconBtn}
                        >
                            <Ionicons
                                name="notifications-outline"
                                size={22}
                                color={colors.gray}
                            />
                            {unreadCount > 0 && (
                                <View style={styles.notifBadge}>
                                    <Text style={styles.notifBadgeText}>
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </Text>
                                </View>
                            )}
                        </Pressable>

                        {/* Logout */}
                        <Pressable onPress={logout} style={styles.iconBtn}>
                            <Ionicons
                                name="log-out-outline"
                                size={22}
                                color={colors.gray}
                            />
                        </Pressable>
                    </View>
                </View>

                {/* ── Quick stats ── */}
                <View style={styles.statsRow}>
                    <StatChip icon="calendar" label="This week" value="—" />
                    <StatChip icon="people"   label="Staff"     value="—" />
                    <StatChip icon="cash"     label="Est. cost" value="—" />
                </View>

                {/* ── Tiles grid ── */}
                <Text style={styles.sectionLabel}>Management</Text>
                <View style={styles.grid}>
                    {tiles.map(tile => (
                        <AdminTile key={tile.label} tile={tile} />
                    ))}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatChip({
    icon,
    label,
    value,
}: {
    icon:  React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    value: string;
}) {
    return (
        <View style={statStyles.chip}>
            <Ionicons name={icon} size={18} color={colors.primary} />
            <Text style={statStyles.value}>{value}</Text>
            <Text style={statStyles.label}>{label}</Text>
        </View>
    );
}

function AdminTile({ tile }: { tile: Tile }) {
    return (
        <Pressable
            style={({ pressed }) => [
                tileStyles.tile,
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
            onPress={tile.onPress}
        >
            <View style={[tileStyles.iconWrap, { backgroundColor: tile.color + '15' }]}>
                <Ionicons name={tile.icon} size={26} color={tile.color} />
            </View>

            {tile.badge && (
                <View style={tileStyles.badge}>
                    <Text style={tileStyles.badgeText}>{tile.badge}</Text>
                </View>
            )}

            <Text style={tileStyles.label}>{tile.label}</Text>
            <Text style={tileStyles.desc} numberOfLines={2}>
                {tile.description}
            </Text>

            <View style={tileStyles.arrow}>
                <Ionicons name="arrow-forward" size={14} color={colors.gray} />
            </View>
        </Pressable>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:    { flex: 1, backgroundColor: '#F8F8FC' },
    scroll:  { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },

    header: {
        flexDirection:  'row',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   24,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems:    'center',
        gap:           14,
        flex:          1,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems:    'center',
        gap:           4,
    },
    avatar: {
        width:           52,
        height:          52,
        borderRadius:    26,
        backgroundColor: colors.primary,
        alignItems:      'center',
        justifyContent:  'center',
        shadowColor:     colors.primary,
        shadowOpacity:   0.3,
        shadowRadius:    6,
        elevation:       4,
    },
    avatarText:   { color: '#fff', fontSize: 20, fontWeight: '800' },
    greeting:     { fontSize: 12, color: colors.gray },
    name:         { fontSize: 18, fontWeight: '800', color: colors.text },
    rolePill: {
        marginTop:         4,
        alignSelf:         'flex-start',
        paddingHorizontal: 8,
        paddingVertical:   2,
        borderRadius:      999,
        backgroundColor:   colors.primary + '15',
    },
    roleText: { fontSize: 11, color: colors.primary, fontWeight: '700' },

    // Icon buttons (bell + logout)
    iconBtn: {
        width:          40,
        height:         40,
        borderRadius:   20,
        backgroundColor: '#F3F4F6',
        alignItems:     'center',
        justifyContent: 'center',
        position:       'relative',
    },

    // Notification badge on bell
    notifBadge: {
        position:        'absolute',
        top:             4,
        right:           4,
        minWidth:        16,
        height:          16,
        borderRadius:    8,
        backgroundColor: colors.error,
        alignItems:      'center',
        justifyContent:  'center',
        paddingHorizontal: 2,
        borderWidth:     1.5,
        borderColor:     '#F8F8FC',
    },
    notifBadgeText: {
        fontSize:   9,
        color:      '#fff',
        fontWeight: '800',
    },

    statsRow: {
        flexDirection: 'row',
        gap:           10,
        marginBottom:  28,
    },
    sectionLabel: {
        fontSize:      13,
        fontWeight:    '700',
        color:         colors.gray,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom:  12,
    },
    grid: {
        flexDirection: 'row',
        flexWrap:      'wrap',
        gap:           12,
    },
});

const statStyles = StyleSheet.create({
    chip: {
        flex:            1,
        alignItems:      'center',
        gap:             2,
        backgroundColor: '#fff',
        borderRadius:    12,
        paddingVertical: 12,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        shadowColor:     '#000',
        shadowOpacity:   0.03,
        shadowRadius:    4,
        elevation:       1,
    },
    value: { fontSize: 16, fontWeight: '800', color: colors.text },
    label: { fontSize: 11, color: colors.gray },
});

const tileStyles = StyleSheet.create({
    tile: {
        width:           '47%',
        backgroundColor: '#fff',
        borderRadius:    16,
        padding:         16,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        shadowColor:     '#000',
        shadowOpacity:   0.04,
        shadowRadius:    6,
        elevation:       2,
        position:        'relative',
        minHeight:       140,
    },
    iconWrap: {
        width:          48,
        height:         48,
        borderRadius:   14,
        alignItems:     'center',
        justifyContent: 'center',
        marginBottom:   10,
    },
    badge: {
        position:          'absolute',
        top:               10,
        right:             10,
        paddingHorizontal: 7,
        paddingVertical:   2,
        borderRadius:      999,
        backgroundColor:   colors.primary + '15',
    },
    badgeText: {
        fontSize:      9,
        color:         colors.primary,
        fontWeight:    '800',
        letterSpacing: 0.5,
    },
    label: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
    desc:  { fontSize: 11, color: colors.gray, lineHeight: 15 },
    arrow: { position: 'absolute', bottom: 12, right: 12 },
});