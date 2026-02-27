// src/screens/admin/InviteStaffScreen.tsx

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    ScrollView,
    ActivityIndicator,
    Alert,
    Modal,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from '@apollo/client/react';
import { colors } from '../../theme/colors';
import {
    MY_LOCATIONS_QUERY,
    SEND_ONBOARDING_INVITE_MUTATION,
} from '../../graphql/operations';

type Location = {
    id: number;
    name: string;
};

type MyLocationsQueryData = {
    myLocations: Location[];
};

type SendInviteData = {
    sendOnboardingInvite: {
        inviteId: number;
        email: string;
    };
};

type SendInviteVars = {
    email: string;
    locationId: number;
    position?: string | null;
};

export default function InviteStaffScreen({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [position, setPosition] = useState('Staff');
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const { data, loading } = useQuery<MyLocationsQueryData>(
        MY_LOCATIONS_QUERY
    );

    useEffect(() => {
        if (data?.myLocations?.length && !selectedLocation) {
            setSelectedLocation(data.myLocations[0]);
        }
    }, [data]);

    const [sendInvite] = useMutation<SendInviteData, SendInviteVars>(
        SEND_ONBOARDING_INVITE_MUTATION
    );

    const handleSendInvite = async () => {
        if (!email.trim()) {
            Alert.alert('Missing email', 'Please enter the employee email.');
            return;
        }

        if (!selectedLocation) {
            Alert.alert('Missing location', 'Please select a location.');
            return;
        }

        try {
            setSubmitting(true);

            await sendInvite({
                variables: {
                    email: email.trim(),
                    locationId: selectedLocation.id,
                    position: position.trim() || null,
                },
            });

            Alert.alert('Success', 'Onboarding invite sent successfully.', [
                {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                },
            ]);

            setEmail('');
            setPosition('Staff');
        } catch (err: any) {
            const message =
                err?.message ||
                err?.graphQLErrors?.[0]?.message ||
                'Failed to send invite.';
            Alert.alert('Error', message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <ScrollView
                contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                keyboardShouldPersistTaps="handled"
            >
                {/* Email Input */}
                <View style={styles.card}>
                    <Text style={styles.label}>Employee email</Text>
                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="employee@company.com"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={styles.input}
                    />

                    <Text style={styles.label}>Position / role (optional)</Text>
                    <TextInput
                        value={position}
                        onChangeText={setPosition}
                        placeholder="Staff, Manager..."
                        style={styles.input}
                    />
                </View>

                {/* Location Selector */}
                <View style={styles.card}>
                    <Text style={styles.label}>Location</Text>

                    {loading ? (
                        <ActivityIndicator />
                    ) : (
                        <Pressable
                            style={styles.locationButton}
                            onPress={() => setModalOpen(true)}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.locationText}>
                                    {selectedLocation?.name ?? 'Select location'}
                                </Text>
                                <Ionicons
                                    name="chevron-down"
                                    size={18}
                                    color={colors.gray}
                                    style={{ marginLeft: 6 }}
                                />
                            </View>
                        </Pressable>
                    )}
                </View>

                {/* Submit Button */}
                <Pressable
                    style={[
                        styles.submitButton,
                        (submitting || !selectedLocation) && { opacity: 0.6 },
                    ]}
                    onPress={handleSendInvite}
                    disabled={submitting || !selectedLocation}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitText}>Send Invite</Text>
                    )}
                </Pressable>
            </ScrollView>

            {/* Location Modal */}
            <Modal visible={modalOpen} transparent animationType="fade">
                <Pressable
                    style={styles.modalBackdrop}
                    onPress={() => setModalOpen(false)}
                >
                    <View style={styles.modalSheet}>
                        <FlatList
                            data={data?.myLocations}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                                <Pressable
                                    style={styles.modalRow}
                                    onPress={() => {
                                        setSelectedLocation(item);
                                        setModalOpen(false);
                                    }}
                                >
                                    <Text>{item.name}</Text>
                                </Pressable>
                            )}
                        />
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

    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },

    label: {
        fontSize: 13,
        marginBottom: 6,
        color: colors.text,
    },

    input: {
        borderWidth: 1,
        borderColor: colors.inputBorder,
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
    },

    locationButton: {
        paddingVertical: 12,
    },

    locationText: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
    },

    submitButton: {
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 999,
        alignItems: 'center',
    },

    submitText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
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
        maxHeight: 300,
    },

    modalRow: {
        paddingVertical: 12,
    },
});