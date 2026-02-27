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

// ✅ Apollo v4 hooks
import { useQuery, useMutation } from '@apollo/client/react';

import { colors } from '../../theme/colors';
import {
    MY_LOCATIONS_QUERY,
    SEND_ONBOARDING_INVITE_MUTATION,
} from '../../graphql/operations';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
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

    // ─────────────────────────────────────────────
    // Load locations
    // ─────────────────────────────────────────────
    const { data, loading } = useQuery<MyLocationsQueryData>(
        MY_LOCATIONS_QUERY,
        { fetchPolicy: 'cache-and-network' }
    );

    useEffect(() => {
        const list = data?.myLocations ?? [];
        setLocations(list);
        if (list.length && !selectedLocation) {
            setSelectedLocation(list[0]);
        }
    }, [data]);

    // ─────────────────────────────────────────────
    // Send Invite Mutation
    // ─────────────────────────────────────────────
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

            Alert.alert('Success', 'Onboarding invite sent.');
            setEmail('');
            setPosition('Staff');
        } catch (err: any) {
            const message =
                err?.message ||
                err?.graphQLErrors?.[0]?.message ||
                'Could not send invite.';
            setError(message);
            Alert.alert('Error', message);
        } finally {
            setSubmitting(false);
        }
    };

    // ─────────────────────────────────────────────
    // UI
    // ─────────────────────────────────────────────
    return (
        <SafeAreaView style={{ flex: 1 }}>
            <View>
                <Text>Test Screen</Text>
            </View>
        </SafeAreaView>
    );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },

    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
    },

    body: { flex: 1 },

    card: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },

    cardTitle: {
        fontWeight: '700',
        marginBottom: 12,
    },

    label: {
        marginBottom: 4,
        fontSize: 13,
    },

    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
    },

    locButton: {
        padding: 12,
        borderWidth: 1,
        borderRadius: 8,
    },

    primaryButton: {
        backgroundColor: colors.primary,
        padding: 14,
        borderRadius: 999,
        alignItems: 'center',
    },

    primaryButtonText: {
        color: '#fff',
        fontWeight: '700',
    },

    modalBackdrop: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },

    modalSheet: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        maxHeight: 300,
    },

    modalRow: {
        paddingVertical: 10,
    },
});