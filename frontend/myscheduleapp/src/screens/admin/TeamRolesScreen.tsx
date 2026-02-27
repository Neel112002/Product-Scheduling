// src/screens/admin/TeamRolesScreen.tsx

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Pressable,
    Modal,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@apollo/client/react';
import { colors } from '../../theme/colors';
import {
    GET_TEAM_MEMBERS_QUERY,
    MY_LOCATIONS_QUERY,
} from '../../graphql/operations';
import TeamMemberCard from '../../components/home/admin/TeamMemberCard';

type Location = {
    id: number;
    name: string;
};

type TeamMember = {
    id: number;
    username: string;
    user_email: string;
    display_name?: string | null;
    role: string;
    isActive: boolean;
};

type LocationsData = {
    myLocations: Location[];
};

type TeamData = {
    teamMembers: TeamMember[];
};

export default function TeamRolesScreen() {
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

    if (locLoading) {
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

    if (teamLoading) {
        return (
            <SafeAreaView style={styles.safe} edges={['top']}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
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

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            {/* Location Selector */}
            <Pressable
                style={styles.locationHeader}
                onPress={() => setModalOpen(true)}
            >
                <Text style={styles.locationText}>
                    {selectedLocation?.name ?? 'Select location'}
                </Text>
            </Pressable>

            {/* Empty State */}
            {!teamData?.teamMembers?.length ? (
                <View style={styles.center}>
                    <Text>No team members found for this location.</Text>
                </View>
            ) : (
                <FlatList
                    contentContainerStyle={{ padding: 16 }}
                    data={teamData.teamMembers}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <TeamMemberCard
                            name={item.display_name || item.username}
                            email={item.user_email}
                            role={item.role}
                            onChangeRole={() => { }}
                        />
                    )}
                />
            )}

            {/* Location Modal */}
            <Modal visible={modalOpen} transparent animationType="fade">
                <Pressable
                    style={styles.modalBackdrop}
                    onPress={() => setModalOpen(false)}
                >
                    <View style={styles.modalSheet}>
                        {locData.myLocations.map((loc) => (
                            <Pressable
                                key={loc.id}
                                style={styles.modalRow}
                                onPress={() => {
                                    setSelectedLocation(loc);
                                    setModalOpen(false);
                                }}
                            >
                                <Text>{loc.name}</Text>
                            </Pressable>
                        ))}
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: colors.background,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    locationHeader: {
        padding: 16,
        borderBottomWidth: 1,
        borderColor: '#eee',
    },
    locationText: {
        fontSize: 16,
        fontWeight: '700',
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