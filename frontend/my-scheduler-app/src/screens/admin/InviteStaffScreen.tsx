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

// Types that match your schema
type Location = {
    id: number;
    name: string;
    address?: string | null;
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

    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [locModalOpen, setLocModalOpen] = useState(false);

    // ── Load locations via GraphQL ────────────────────────────────
    const {
        data: locData,
        loading: locLoading,
        error: locError,
        refetch: refetchLocations,
    } = useQuery<MyLocationsQueryData>(MY_LOCATIONS_QUERY, {
        fetchPolicy: 'cache-and-network',
    });

    useEffect(() => {
        const list = locData?.myLocations ?? [];
        setLocations(list);
        if (list.length && !selectedLocation) {
            setSelectedLocation(list[0]);
        }
    }, [locData, selectedLocation]);

    // ── Mutation for sending invite ───────────────────────────────
    const [sendInvite] = useMutation<SendInviteData, SendInviteVars>(
        SEND_ONBOARDING_INVITE_MUTATION,
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

        setSubmitting(true);
        setError(null);

        try {
            await sendInvite({
                variables: {
                    email: email.trim(),
                    locationId: selectedLocation.id,
                    position: position.trim() || null,
                },
            });

            Alert.alert(
                'Invite sent',
                `Onboarding email has been sent to ${email.trim()}.`,
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.goBack?.(),
                    },
                ],
            );

            // reset form
            setEmail('');
            setPosition('Staff');
        } catch (e: any) {
            console.error('[InviteStaffScreen] sendInvite error:', e);
            const msg =
                e?.message ||
                e?.graphQLErrors?.[0]?.message ||
                'Could not send invite. Please try again.';
            setError(msg);
            Alert.alert('Error', msg);
        } finally {
            setSubmitting(false);
        }
    };

    const loadingState = locLoading && !locations.length;

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack?.()} style={{ padding: 4 }}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Invite staff</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                style={styles.body}
                contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Employee details</Text>

                    <Text style={styles.label}>Employee email</Text>
                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="employee@yourcafe.com"
                        placeholderTextColor={colors.gray}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={styles.input}
                    />

                    <Text style={styles.label}>Position / role (optional)</Text>
                    <TextInput
                        value={position}
                        onChangeText={setPosition}
                        placeholder="Barista, Cashier, Server..."
                        placeholderTextColor={colors.gray}
                        style={styles.input}
                    />
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Location</Text>

                    {loadingState ? (
                        <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                            <ActivityIndicator />
                            <Text style={styles.helperText}>Loading locations…</Text>
                        </View>
                    ) : locations.length === 0 ? (
                        <Text style={styles.helperText}>
                            No locations available. Add a location first in the admin panel.
                        </Text>
                    ) : (
                        <>
                            <Text style={styles.label}>Send invite for location</Text>
                            <Pressable
                                onPress={() => setLocModalOpen(true)}
                                style={({ pressed }) => [
                                    styles.locButton,
                                    pressed && { opacity: 0.9 },
                                ]}
                            >
                                <Ionicons
                                    name="location-outline"
                                    size={18}
                                    color={colors.primary}
                                />
                                <Text style={styles.locText}>
                                    {selectedLocation?.name ?? 'Select location'}
                                </Text>
                                <Ionicons
                                    name="chevron-down"
                                    size={18}
                                    color={colors.gray}
                                />
                            </Pressable>
                        </>
                    )}

                    {locError && (
                        <Text style={[styles.helperText, { color: '#f97373' }]}>
                            Could not load locations. Pull to refresh and try again.
                        </Text>
                    )}

                    {error && (
                        <Text style={[styles.helperText, { color: '#f97373' }]}>
                            {error}
                        </Text>
                    )}
                </View>

                <Pressable
                    onPress={handleSendInvite}
                    disabled={submitting || !selectedLocation}
                    style={({ pressed }) => [
                        styles.primaryButton,
                        (submitting || !selectedLocation) && { opacity: 0.6 },
                        pressed && !submitting && { opacity: 0.85 },
                    ]}
                >
                    {submitting ? (
                        <ActivityIndicator color={colors.buttonText} />
                    ) : (
                        <Text style={styles.primaryButtonText}>Send onboarding email</Text>
                    )}
                </Pressable>
            </ScrollView>

            {/* Location selection modal */}
            <Modal
                visible={locModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setLocModalOpen(false)}
            >
                <Pressable
                    style={styles.modalBackdrop}
                    onPress={() => setLocModalOpen(false)}
                >
                    <View />
                </Pressable>

                <View style={styles.modalSheet}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Select location</Text>
                        <Pressable onPress={() => setLocModalOpen(false)} hitSlop={8}>
                            <Ionicons name="close" size={20} color={colors.gray} />
                        </Pressable>
                    </View>

                    <FlatList
                        data={locations}
                        keyExtractor={(item) => String(item.id)}
                        ItemSeparatorComponent={() => (
                            <View style={styles.modalSeparator} />
                        )}
                        renderItem={({ item }) => {
                            const active = item.id === selectedLocation?.id;
                            return (
                                <Pressable
                                    onPress={() => {
                                        setSelectedLocation(item);
                                        setLocModalOpen(false);
                                    }}
                                    style={({ pressed }) => [
                                        styles.modalRow,
                                        pressed && { backgroundColor: '#F7F7F7' },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.modalRowText,
                                            active && {
                                                color: colors.primary,
                                                fontWeight: '700',
                                            },
                                        ]}
                                    >
                                        {item.name}
                                    </Text>
                                    {active && (
                                        <Ionicons
                                            name="checkmark"
                                            size={18}
                                            color={colors.primary}
                                        />
                                    )}
                                </Pressable>
                            );
                        }}
                    />
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
    },
    body: { flex: 1 },

    card: {
        backgroundColor: colors.background,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#00000010',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 8,
    },

    label: { fontSize: 13, color: colors.text, marginBottom: 4 },
    input: {
        borderWidth: 1,
        borderColor: colors.inputBorder,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 14,
        color: colors.text,
        marginBottom: 12,
    },
    helperText: { fontSize: 12, color: colors.gray, marginTop: 4 },

    locButton: {
        marginTop: 4,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    locText: { flex: 1, fontSize: 14, color: colors.text },

    primaryButton: {
        marginTop: 4,
        marginHorizontal: 16,
        borderRadius: 999,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
    },
    primaryButtonText: {
        color: colors.buttonText,
        fontWeight: '700',
        fontSize: 15,
    },

    // modal
    modalBackdrop: {
        position: 'absolute',
        inset: 0 as any,
        backgroundColor: 'rgba(0,0,0,0.15)',
    },
    modalSheet: {
        position: 'absolute',
        left: 16,
        right: 16,
        top: 120,
        borderRadius: 14,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: '#00000010',
        padding: 10,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
        maxHeight: 340,
    },
    modalHeader: {
        paddingHorizontal: 4,
        paddingVertical: 6,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalTitle: { color: colors.text, fontWeight: '700' },
    modalSeparator: {
        height: 1,
        backgroundColor: colors.inputBorder,
        opacity: 0.7,
    },
    modalRow: {
        paddingVertical: 10,
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    modalRowText: { color: colors.text, fontSize: 14 },
});
