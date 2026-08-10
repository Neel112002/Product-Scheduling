// src/screens/admin/TeamRolesScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    Pressable,
    Modal,
    SectionList,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { useQuery }     from '@apollo/client/react';
import { colors }       from '../../theme/colors';
import {
    GET_TEAM_MEMBERS_QUERY,
    MY_LOCATIONS_QUERY,
} from '../../graphql/operations';

// ── Types ─────────────────────────────────────────────────────────────────────

type Location = { id: number; name: string };

type Role = {
    id:         number;
    name:       string;
    locationId: number;
    isSystem:   boolean;
};

type TeamMember = {
    id:            number;
    username:      string;
    user_email:    string;
    display_name?: string | null;
    role:          Role;
    isActive:      boolean;
};

type LocationsData = { myLocations:  Location[]   };
type TeamData      = { teamMembers:  TeamMember[] };

// ── Role color map ────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
    owner:      { bg: colors.primary + '20', text: colors.primary  },
    manager:    { bg: '#10B981'      + '20', text: '#10B981'        },
    supervisor: { bg: '#F59E0B'      + '20', text: '#F59E0B'        },
    staff:      { bg: '#6366F1'      + '20', text: '#6366F1'        },
};

function getRoleColor(name: string) {
    return ROLE_COLORS[name.toLowerCase()] ?? { bg: '#F3F4F6', text: colors.gray };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TeamRolesScreen({ navigation }: any) {
    const [selectedLocation,  setSelectedLocation]  = useState<Location | null>(null);
    const [locationModalOpen, setLocationModalOpen] = useState(false);

    // ── Locations ─────────────────────────────────────────────────────────────
    const { data: locData, loading: locLoading } =
        useQuery<LocationsData>(MY_LOCATIONS_QUERY);

    useEffect(() => {
        if (locData?.myLocations?.length && !selectedLocation) {
            setSelectedLocation(locData.myLocations[0]);
        }
    }, [locData]);

    // ── Team members ──────────────────────────────────────────────────────────
    const {
        data:    teamData,
        loading: teamLoading,
        refetch: refetchTeam,
    } = useQuery<TeamData>(GET_TEAM_MEMBERS_QUERY, {
        variables:   { locationId: selectedLocation?.id },
        skip:        !selectedLocation,
        fetchPolicy: 'cache-and-network',
    });

    // ── Sections grouped by role ──────────────────────────────────────────────
    const sections = useMemo(() => {
        const members = teamData?.teamMembers ?? [];
        const ORDER   = ['owner', 'manager', 'supervisor', 'staff'];

        const grouped = new Map<string, TeamMember[]>();
        members.forEach(m => {
            const key = (m.role?.name ?? 'Staff').toLowerCase();
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(m);
        });

        const result: { title: string; roleKey: string; data: TeamMember[] }[] = [];

        ORDER.forEach(key => {
            if (grouped.has(key)) {
                const list  = grouped.get(key)!;
                const label = key.charAt(0).toUpperCase() + key.slice(1);
                result.push({ title: `${label}s (${list.length})`, roleKey: key, data: list });
            }
        });

        grouped.forEach((list, key) => {
            if (!ORDER.includes(key)) {
                result.push({ title: `${key} (${list.length})`, roleKey: key, data: list });
            }
        });

        return result;
    }, [teamData]);

    const onRefresh   = useCallback(async () => { await refetchTeam(); }, [refetchTeam]);
    const totalCount  = teamData?.teamMembers?.length ?? 0;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>

            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Team & Roles</Text>
                <Pressable
                    onPress={() => navigation.navigate('InviteStaff')}
                    style={styles.inviteBtn}
                >
                    <Ionicons name="person-add-outline" size={18} color={colors.primary} />
                </Pressable>
            </View>

            {/* Location bar */}
            <Pressable
                style={styles.locationBar}
                onPress={() => setLocationModalOpen(true)}
            >
                <Ionicons name="location-outline" size={15} color={colors.primary} />
                <Text style={styles.locationName}>
                    {selectedLocation?.name ?? 'Select location'}
                </Text>
                <Text style={styles.memberCount}>{totalCount} members</Text>
                <Ionicons name="chevron-down" size={15} color={colors.gray} />
            </Pressable>

            {/* Content */}
            {locLoading || (teamLoading && !teamData) ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading team...</Text>
                </View>
            ) : totalCount === 0 ? (
                <View style={styles.center}>
                    <View style={styles.emptyIconWrap}>
                        <Ionicons name="people-outline" size={40} color={colors.gray} />
                    </View>
                    <Text style={styles.emptyTitle}>No team members yet</Text>
                    <Text style={styles.emptySub}>Invite staff to get started.</Text>
                    <Pressable
                        style={styles.inviteNowBtn}
                        onPress={() => navigation.navigate('InviteStaff')}
                    >
                        <Ionicons name="person-add-outline" size={16} color="#fff" />
                        <Text style={styles.inviteNowText}>Invite Staff</Text>
                    </Pressable>
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={item => String(item.id)}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
                    stickySectionHeadersEnabled={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={teamLoading}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    renderSectionHeader={({ section }) => {
                        const roleColor = getRoleColor(section.roleKey);
                        return (
                            <View style={styles.sectionHeader}>
                                <View style={[styles.sectionDot, { backgroundColor: roleColor.text }]} />
                                <Text style={styles.sectionTitle}>{section.title}</Text>
                            </View>
                        );
                    }}
                    renderItem={({ item }) => (
                        <MemberCard
                            member={item}
                            onPress={() => navigation.navigate('EmployeeProfile', {
                                userId:     item.id,
                                locationId: selectedLocation?.id ?? 0,
                            })}
                        />
                    )}
                    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                    SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
                />
            )}

            {/* Location picker modal */}
            <Modal visible={locationModalOpen} transparent animationType="fade">
                <Pressable
                    style={styles.modalBackdrop}
                    onPress={() => setLocationModalOpen(false)}
                >
                    <View style={styles.modalSheet}>
                        <Text style={styles.modalTitle}>Select location</Text>
                        {(locData?.myLocations ?? []).map(loc => (
                            <Pressable
                                key={loc.id}
                                style={[
                                    styles.modalRow,
                                    selectedLocation?.id === loc.id && styles.modalRowActive,
                                ]}
                                onPress={() => {
                                    setSelectedLocation(loc);
                                    setLocationModalOpen(false);
                                }}
                            >
                                <Text style={[
                                    styles.modalRowText,
                                    selectedLocation?.id === loc.id && {
                                        color: colors.primary, fontWeight: '700',
                                    },
                                ]}>
                                    {loc.name}
                                </Text>
                                {selectedLocation?.id === loc.id && (
                                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                                )}
                            </Pressable>
                        ))}
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

// ── MemberCard ────────────────────────────────────────────────────────────────

function MemberCard({
    member,
    onPress,
}: {
    member:  TeamMember;
    onPress: () => void;
}) {
    const name     = member.display_name || member.username;
    const initials = name.trim().split(/\s+/).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
    const rc       = getRoleColor(member.role?.name ?? 'staff');

    return (
        <Pressable
            style={({ pressed }) => [
                cardStyles.card,
                pressed && { opacity: 0.85 },
            ]}
            onPress={onPress}
        >
            {/* Avatar */}
            <View style={[cardStyles.avatar, { backgroundColor: rc.bg }]}>
                <Text style={[cardStyles.avatarText, { color: rc.text }]}>{initials}</Text>
            </View>

            {/* Info */}
            <View style={cardStyles.info}>
                <Text style={cardStyles.name}  numberOfLines={1}>{name}</Text>
                <Text style={cardStyles.email} numberOfLines={1}>{member.user_email}</Text>
            </View>

            {/* Role badge */}
            <View style={[cardStyles.roleBadge, { backgroundColor: rc.bg }]}>
                <Text style={[cardStyles.roleText, { color: rc.text }]}>
                    {member.role?.name ?? 'Staff'}
                </Text>
            </View>

            {/* Arrow — navigates to profile */}
            <Ionicons name="chevron-forward" size={16} color={colors.gray} />
        </Pressable>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
    card: {
        flexDirection:   'row',
        alignItems:      'center',
        backgroundColor: '#fff',
        borderRadius:    14,
        padding:         12,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        shadowColor:     '#000',
        shadowOpacity:   0.03,
        shadowRadius:    4,
        elevation:       1,
        gap:             10,
    },
    avatar: {
        width:          42,
        height:         42,
        borderRadius:   21,
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
    },
    avatarText: { fontSize: 16, fontWeight: '700' },
    info:       { flex: 1, minWidth: 0 },
    name:       { fontSize: 14, fontWeight: '700', color: colors.text  },
    email:      { fontSize: 11, color: colors.gray, marginTop: 1 },
    roleBadge: {
        paddingHorizontal: 10,
        paddingVertical:    4,
        borderRadius:      999,
        flexShrink:        0,
    },
    roleText: { fontSize: 11, fontWeight: '700' },
});

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8F8FC' },

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
    inviteBtn: {
        width:           36,
        height:          36,
        borderRadius:    18,
        backgroundColor: colors.subtleAccent,
        alignItems:      'center',
        justifyContent:  'center',
    },

    locationBar: {
        flexDirection:     'row',
        alignItems:        'center',
        gap:               6,
        paddingHorizontal: 16,
        paddingVertical:   10,
        backgroundColor:   colors.subtleAccent,
        borderBottomWidth: 1,
        borderBottomColor: '#E8E8F0',
    },
    locationName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
    memberCount:  { fontSize: 12, color: colors.gray },

    sectionHeader: {
        flexDirection:  'row',
        alignItems:     'center',
        gap:            8,
        paddingVertical: 12,
        paddingTop:     16,
    },
    sectionDot:   { width: 8, height: 8, borderRadius: 4 },
    sectionTitle: {
        fontSize:      12,
        fontWeight:    '700',
        color:         colors.gray,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },

    center: {
        flex:           1,
        alignItems:     'center',
        justifyContent: 'center',
        gap:            10,
        padding:        32,
    },
    loadingText:  { fontSize: 13, color: colors.gray },
    emptyIconWrap: {
        width:           72,
        height:          72,
        borderRadius:    36,
        backgroundColor: '#F3F4F6',
        alignItems:      'center',
        justifyContent:  'center',
        marginBottom:    4,
    },
    emptyTitle:   { fontSize: 17, fontWeight: '700', color: colors.text },
    emptySub:     { fontSize: 13, color: colors.gray, textAlign: 'center' },
    inviteNowBtn: {
        flexDirection:     'row',
        alignItems:        'center',
        gap:               6,
        marginTop:         8,
        paddingHorizontal: 20,
        paddingVertical:   11,
        borderRadius:      999,
        backgroundColor:   colors.primary,
    },
    inviteNowText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    modalBackdrop: {
        flex:            1,
        justifyContent:  'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    modalSheet: {
        backgroundColor:      '#fff',
        borderTopLeftRadius:  20,
        borderTopRightRadius: 20,
        paddingTop:           8,
        paddingBottom:        32,
        maxHeight:            '70%',
    },
    modalTitle: {
        fontSize:          12,
        fontWeight:        '700',
        color:             colors.gray,
        paddingHorizontal: 20,
        paddingVertical:   12,
        textTransform:     'uppercase',
        letterSpacing:     0.8,
    },
    modalRow: {
        flexDirection:     'row',
        alignItems:        'center',
        justifyContent:    'space-between',
        paddingHorizontal: 20,
        paddingVertical:   14,
    },
    modalRowActive: { backgroundColor: colors.subtleAccent },
    modalRowText:   { fontSize: 15, color: colors.text },
});