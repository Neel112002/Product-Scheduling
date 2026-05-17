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
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { useQuery, useMutation } from '@apollo/client/react';
import { colors }       from '../../theme/colors';
import {
    MY_LOCATIONS_QUERY,
    SEND_ONBOARDING_INVITE_MUTATION,
} from '../../graphql/operations';

// ── Types ─────────────────────────────────────────────────────────────────────

type Location = { id: number; name: string };
type MyLocationsQueryData = { myLocations: Location[] };
type SendInviteData = {
    sendOnboardingInvite: { inviteId: number; email: string };
};
type SendInviteVars = {
    email:      string;
    locationId: number;
    position?:  string | null;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function InviteStaffScreen({ navigation }: any) {
    const [email,            setEmail]            = useState('');
    const [position,         setPosition]         = useState('Staff');
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
    const [modalOpen,        setModalOpen]        = useState(false);
    const [submitting,       setSubmitting]       = useState(false);

    const { data, loading } = useQuery<MyLocationsQueryData>(MY_LOCATIONS_QUERY);

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

        setSubmitting(true);
        try {
            await sendInvite({
                variables: {
                    email:      email.trim().toLowerCase(),
                    locationId: selectedLocation.id,
                    position:   position.trim() || null,
                },
            });

            Alert.alert(
                'Invite sent ✓',
                `An email with login details has been sent to ${email.trim()}.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
            setEmail('');
            setPosition('Staff');
        } catch (err: any) {
            const message =
                err?.graphQLErrors?.[0]?.message ||
                err?.message ||
                'Failed to send invite.';
            Alert.alert('Error', message);
        } finally {
            setSubmitting(false);
        }
    };

    const locations = data?.myLocations ?? [];

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>

            {/* ── Header ── */}
            <View style={styles.header}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                >
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Invite Staff</Text>
                <View style={{ width: 36 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── Intro banner ── */}
                    <View style={styles.infoBanner}>
                        <Ionicons name="mail-outline" size={20} color={colors.primary} />
                        <Text style={styles.infoText}>
                            The staff member will receive an email with a temporary password
                            and can log in immediately.
                        </Text>
                    </View>

                    {/* ── Form card ── */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Employee details</Text>

                        <Text style={styles.label}>Email address</Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="employee@company.com"
                            placeholderTextColor={colors.gray}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            autoCorrect={false}
                            style={styles.input}
                            returnKeyType="next"
                        />

                        <Text style={[styles.label, { marginTop: 4 }]}>
                            Position / role
                            <Text style={styles.optional}> (optional)</Text>
                        </Text>
                        <TextInput
                            value={position}
                            onChangeText={setPosition}
                            placeholder="e.g. Barista, Server, Host..."
                            placeholderTextColor={colors.gray}
                            style={styles.input}
                            returnKeyType="done"
                        />
                    </View>

                    {/* ── Location card ── */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Assign to location</Text>

                        {loading ? (
                            <ActivityIndicator color={colors.primary} />
                        ) : locations.length === 0 ? (
                            <Text style={styles.noLocText}>No locations found.</Text>
                        ) : locations.length === 1 ? (
                            /* Single location — just show it, no picker needed */
                            <View style={styles.singleLocation}>
                                <Ionicons name="location-outline" size={16} color={colors.primary} />
                                <Text style={styles.singleLocationText}>
                                    {locations[0].name}
                                </Text>
                                <View style={styles.defaultBadge}>
                                    <Text style={styles.defaultBadgeText}>Default</Text>
                                </View>
                            </View>
                        ) : (
                            /* Multiple locations — show picker */
                            <Pressable
                                style={styles.locationPicker}
                                onPress={() => setModalOpen(true)}
                            >
                                <Ionicons name="location-outline" size={16} color={colors.primary} />
                                <Text style={styles.locationPickerText}>
                                    {selectedLocation?.name ?? 'Select location'}
                                </Text>
                                <Ionicons
                                    name="chevron-down"
                                    size={16}
                                    color={colors.gray}
                                    style={{ marginLeft: 'auto' }}
                                />
                            </Pressable>
                        )}
                    </View>

                    {/* ── Send button ── */}
                    <Pressable
                        style={[
                            styles.sendBtn,
                            (submitting || !selectedLocation || !email.trim()) && { opacity: 0.5 },
                        ]}
                        onPress={handleSendInvite}
                        disabled={submitting || !selectedLocation || !email.trim()}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="send-outline" size={18} color="#fff" />
                                <Text style={styles.sendBtnText}>Send Invite</Text>
                            </>
                        )}
                    </Pressable>

                    <Text style={styles.footerNote}>
                        Staff will be assigned the "Staff" role by default.
                        You can change their role from Team &amp; Roles after they join.
                    </Text>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ── Location picker modal ── */}
            <Modal visible={modalOpen} transparent animationType="fade">
                <Pressable
                    style={styles.modalBackdrop}
                    onPress={() => setModalOpen(false)}
                >
                    <View style={styles.modalSheet}>
                        <Text style={styles.modalTitle}>Select location</Text>
                        <FlatList
                            data={locations}
                            keyExtractor={item => String(item.id)}
                            renderItem={({ item }) => (
                                <Pressable
                                    style={[
                                        styles.modalRow,
                                        selectedLocation?.id === item.id && styles.modalRowActive,
                                    ]}
                                    onPress={() => {
                                        setSelectedLocation(item);
                                        setModalOpen(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.modalRowText,
                                        selectedLocation?.id === item.id && { color: colors.primary, fontWeight: '700' },
                                    ]}>
                                        {item.name}
                                    </Text>
                                    {selectedLocation?.id === item.id && (
                                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                                    )}
                                </Pressable>
                            )}
                            ItemSeparatorComponent={() => (
                                <View style={{ height: 1, backgroundColor: '#F0F0F0' }} />
                            )}
                        />
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:    { flex: 1, backgroundColor: '#F8F8FC' },
    content: { padding: 16, paddingBottom: 40 },

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
    headerTitle: {
        flex:       1,
        fontSize:   18,
        fontWeight: '700',
        color:      colors.text,
        textAlign:  'center',
    },

    infoBanner: {
        flexDirection:   'row',
        alignItems:      'flex-start',
        gap:             10,
        backgroundColor: colors.subtleAccent,
        borderRadius:    12,
        padding:         12,
        marginBottom:    16,
        borderWidth:     1,
        borderColor:     colors.primary + '20',
    },
    infoText: {
        flex:       1,
        fontSize:   13,
        color:      colors.text,
        lineHeight: 20,
    },

    card: {
        backgroundColor: '#fff',
        borderRadius:    16,
        padding:         16,
        marginBottom:    12,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        shadowColor:     '#000',
        shadowOpacity:   0.03,
        shadowRadius:    4,
        elevation:       1,
    },
    cardTitle: {
        fontSize:     15,
        fontWeight:   '700',
        color:        colors.text,
        marginBottom: 14,
    },

    label: {
        fontSize:     13,
        fontWeight:   '600',
        color:        colors.text,
        marginBottom: 6,
    },
    optional: {
        fontWeight: '400',
        color:      colors.gray,
    },

    input: {
        borderWidth:       1,
        borderColor:       colors.inputBorder,
        borderRadius:      10,
        paddingHorizontal: 12,
        paddingVertical:   10,
        fontSize:          14,
        color:             colors.text,
        backgroundColor:   '#FAFAFA',
        marginBottom:      12,
    },

    // Single location
    singleLocation: {
        flexDirection:   'row',
        alignItems:      'center',
        gap:             8,
        backgroundColor: colors.subtleAccent,
        borderRadius:    10,
        padding:         12,
    },
    singleLocationText: {
        flex:       1,
        fontSize:   14,
        fontWeight: '600',
        color:      colors.text,
    },
    defaultBadge: {
        paddingHorizontal: 8,
        paddingVertical:   2,
        borderRadius:      999,
        backgroundColor:   colors.primary + '20',
    },
    defaultBadgeText: {
        fontSize:   11,
        color:      colors.primary,
        fontWeight: '700',
    },
    noLocText: { fontSize: 13, color: colors.gray },

    // Multi-location picker
    locationPicker: {
        flexDirection:   'row',
        alignItems:      'center',
        gap:             8,
        borderWidth:     1,
        borderColor:     colors.inputBorder,
        borderRadius:    10,
        paddingHorizontal: 12,
        paddingVertical:   12,
        backgroundColor: '#FAFAFA',
    },
    locationPickerText: {
        flex:       1,
        fontSize:   14,
        fontWeight: '600',
        color:      colors.text,
    },

    // Send button
    sendBtn: {
        flexDirection:   'row',
        alignItems:      'center',
        justifyContent:  'center',
        gap:             8,
        backgroundColor: colors.primary,
        borderRadius:    999,
        paddingVertical: 14,
        marginTop:       4,
        shadowColor:     colors.primary,
        shadowOpacity:   0.25,
        shadowRadius:    8,
        elevation:       4,
    },
    sendBtnText: {
        color:      '#fff',
        fontWeight: '700',
        fontSize:   15,
    },

    footerNote: {
        fontSize:   12,
        color:      colors.gray,
        textAlign:  'center',
        marginTop:  16,
        lineHeight: 18,
        paddingHorizontal: 8,
    },

    // Modal
    modalBackdrop: {
        flex:            1,
        justifyContent:  'center',
        padding:         24,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    modalSheet: {
        backgroundColor: '#fff',
        borderRadius:    16,
        paddingVertical: 8,
        maxHeight:       320,
    },
    modalTitle: {
        fontSize:          14,
        fontWeight:        '700',
        color:             colors.gray,
        paddingHorizontal: 16,
        paddingVertical:   10,
        textTransform:     'uppercase',
        letterSpacing:     0.6,
    },
    modalRow: {
        flexDirection:     'row',
        alignItems:        'center',
        justifyContent:    'space-between',
        paddingHorizontal: 16,
        paddingVertical:   14,
    },
    modalRowActive:  { backgroundColor: colors.subtleAccent },
    modalRowText:    { fontSize: 15, color: colors.text },
});