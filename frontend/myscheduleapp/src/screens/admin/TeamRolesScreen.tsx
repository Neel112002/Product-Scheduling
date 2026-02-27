// src/screens/admin/TeamRolesScreen.tsx

import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    Pressable,
    Modal,
    SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@apollo/client/react';
import { colors } from '../../theme/colors';
import {
    GET_TEAM_MEMBERS_QUERY,
    MY_LOCATIONS_QUERY,
} from '../../graphql/operations';
import TeamMemberCard from '../../components/home/admin/TeamMemberCard';

/* ===========================
   TYPES (UPDATED FOR RBAC)
=========================== */

type Location = {
    id: number;
    name: string;
};

type Role = {
    id: number;
    name: string;
    locationId: number;
    isSystem: boolean;
};

type TeamMember = {
    id: number;
    username: string;
    user_email: string;
    display_name?: string | null;
    role: Role;
    isActive: boolean;
};

type LocationsData = {
    myLocations: Location[];
};

type TeamData = {
    teamMembers: TeamMember[];
};

/* ===========================
   SCREEN
=========================== */

export default function TeamRolesScreen({ navigation }: any) {
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const { data: locData, loading: locLoading } =
        useQuery<LocationsData>(MY_LOCATIONS_QUERY);

    useEffect(() => {
        if (locData?.myLocations?.length && !selectedLocation) {
            setSelectedLocation(locData.myLocations[0]);
        }
    }, [locData]);

    const {
        data: teamData,
        loading: teamLoading,
        error: teamError,
    } = useQuery<TeamData>(GET_TEAM_MEMBERS_QUERY, {
        variables: { locationId: selectedLocation?.id },
        skip: !selectedLocation,
        fetchPolicy: 'cache-and-network',
    });

    /* ===========================
       GROUP BY ROLE (UPDATED)
    =========================== */

    const sections = useMemo(() => {
        const members = teamData?.teamMembers ?? [];

        const owners = members.filter(
            (m) => (m.role?.name || '').toLowerCase() === 'owner'
        );

        const managers = members.filter(
            (m) => (m.role?.name || '').toLowerCase() === 'manager'
        );

        const staff = members.filter(
            (m) =>
                !['owner', 'manager'].includes(
                    (m.role?.name || '').toLowerCase()
                )
        );

        const result: { title: string; data: TeamMember[] }[] = [];

        if (owners.length)
            result.push({ title: `Owners (${owners.length})`, data: owners });

        if (managers.length)
            result.push({
                title: `Managers (${managers.length})`,
                data: managers,
            });

        if (staff.length)
            result.push({ title: `Staff (${staff.length})`, data: staff });

        return result;
    }, [teamData]);

    /* ===========================
       LOADING / ERROR STATES
    =========================== */

    if (locLoading || teamLoading) {
        return (
            <SafeAreaView style={styles.safe} edges={['top']}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (!locData?.myLocations?.length) {
        return (
            <SafeAreaView style={styles.safe} edges={['top']}>
                <View style={styles.center}>
                    <Text>No locations found.</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (teamError) {
        return (
            <SafeAreaView style={styles.safe} edges={['top']}>
                <View style={styles.center}>
                    <Text style={{ color: 'red' }}>
                        Failed to load team members.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    /* ===========================
       RENDER
    =========================== */

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <LocationHeader
                location={selectedLocation}
                onPressLocation={() => setModalOpen(true)}
                onPressAdd={() => navigation.navigate('InviteStaff')}
            />

            {!teamData?.teamMembers?.length ? (
                <View style={styles.center}>
                    <Text>No team members found for this location.</Text>
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    renderSectionHeader={({ section }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <TeamMemberCard
                            name={item.display_name || item.username}
                            email={item.user_email}
                        />
                    )}
                />
            )}

            <LocationModal
                visible={modalOpen}
                locations={locData.myLocations}
                onClose={() => setModalOpen(false)}
                onSelect={(loc) => {
                    setSelectedLocation(loc);
                    setModalOpen(false);
                }}
            />
        </SafeAreaView>
    );
}

/* ===========================
   LOCATION HEADER
=========================== */

function LocationHeader({
    location,
    onPressLocation,
    onPressAdd,
}: {
    location: Location | null;
    onPressLocation: () => void;
    onPressAdd: () => void;
}) {
    return (
        <View style={styles.locationRow}>
            <Pressable style={styles.locationButton} onPress={onPressLocation}>
                <View style={styles.locationContent}>
                    <Text style={styles.locationText}>
                        {location?.name ?? 'Select location'}
                    </Text>

                    <Ionicons
                        name="chevron-down"
                        size={18}
                        color={colors.gray}
                        style={{ marginLeft: 6 }}
                    />
                </View>
            </Pressable>

            <Pressable style={styles.addButton} onPress={onPressAdd}>
                <Text style={styles.addButtonText}>+</Text>
            </Pressable>
        </View>
    );
}

/* ===========================
   LOCATION MODAL
=========================== */

function LocationModal({
    visible,
    locations,
    onSelect,
    onClose,
}: {
    visible: boolean;
    locations: Location[];
    onSelect: (loc: Location) => void;
    onClose: () => void;
}) {
    return (
        <Modal visible={visible} transparent animationType="fade">
            <Pressable style={styles.modalBackdrop} onPress={onClose}>
                <View style={styles.modalSheet}>
                    {locations.map((loc) => (
                        <Pressable
                            key={loc.id}
                            style={styles.modalRow}
                            onPress={() => onSelect(loc)}
                        >
                            <Text>{loc.name}</Text>
                        </Pressable>
                    ))}
                </View>
            </Pressable>
        </Modal>
    );
}

/* ===========================
   STYLES
=========================== */

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderColor: '#eee',
    },

    locationButton: {
        flex: 1,
    },

    locationContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    locationText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
    },

    addButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },

    addButtonText: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '600',
        marginTop: -2,
    },

    sectionHeader: {
        backgroundColor: '#F6F7FB',
        paddingVertical: 8,
        paddingHorizontal: 16,
    },

    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.gray,
        textTransform: 'uppercase',
    },

    modalBackdrop: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },

    modalSheet: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
    },

    modalRow: {
        paddingVertical: 12,
    },
});