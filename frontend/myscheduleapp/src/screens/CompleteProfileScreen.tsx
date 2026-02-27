// src/screens/CompleteProfileScreen.tsx
import React, { useContext, useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@apollo/client/react';

import { colors } from '../theme/colors';
import { AuthContext } from '../context/AuthContext';
import { UPDATE_PROFILE_MUTATION } from '../graphql/operations';

// --- Types for the mutation result/variables --------------------

type UpdateProfileResponse = {
    updateProfile: {
        user_id: number;
        username: string;
        user_email: string;
        display_name?: string | null;
        role?: string | null;
        company?: { id: number; name: string } | null;
        primaryLocation?: { id: number; name: string } | null;
    };
};

type UpdateProfileVars = {
    displayName?: string;
    phone?: string;
};

export default function CompleteProfileScreen({ navigation }: any) {
    const { user, setUser } = useContext(AuthContext);

    const [displayName, setDisplayName] = useState(user?.display_name ?? '');
    const [phone, setPhone] = useState('');

    const [updateProfile, { loading }] = useMutation<
        UpdateProfileResponse,
        UpdateProfileVars
    >(UPDATE_PROFILE_MUTATION);

    // keep local state in sync if user changes in context
    useEffect(() => {
        setDisplayName(user?.display_name ?? '');
    }, [user?.display_name]);

    const handleSave = async () => {
        const trimmedName = displayName.trim();
        const trimmedPhone = phone.trim();

        if (!trimmedName) {
            Alert.alert('Missing name', 'Please enter your display name.');
            return;
        }

        try {
            const { data } = await updateProfile({
                variables: {
                    displayName: trimmedName,
                    phone: trimmedPhone || undefined,
                },
            });

            const updatedUser = data?.updateProfile;
            if (!updatedUser) {
                throw new Error('updateProfile returned no user');
            }

            // Push updated user into AuthContext
            setUser(updatedUser);

            Alert.alert('Profile updated', 'Your profile has been saved.', [
                {
                    text: 'OK',
                    onPress: () => navigation.goBack?.(),
                },
            ]);
        } catch (err: any) {
            console.error('[CompleteProfile] update error', err);
            Alert.alert(
                'Error',
                err?.message || 'Could not update your profile. Please try again.',
            );
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                <Text style={styles.title}>Complete your profile</Text>
                <Text style={styles.subtitle}>
                    Add a friendly display name so your team can recognize you.
                </Text>

                <Text style={styles.label}>Display name</Text>
                <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="e.g. Neel Shah"
                    placeholderTextColor={colors.gray}
                    style={styles.input}
                />

                <Text style={styles.label}>Phone (optional)</Text>
                <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="e.g. 647-555-1234"
                    placeholderTextColor={colors.gray}
                    keyboardType="phone-pad"
                    style={styles.input}
                />

                <Pressable
                    style={({ pressed }) => [
                        styles.primaryButton,
                        pressed && { opacity: 0.9 },
                    ]}
                    onPress={handleSave}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color={colors.buttonText} />
                    ) : (
                        <Text style={styles.primaryButtonText}>Save profile</Text>
                    )}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: {
        flex: 1,
        padding: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 13,
        color: colors.gray,
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        color: colors.text,
        marginBottom: 4,
        marginTop: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.inputBorder,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 14,
        color: colors.text,
    },
    primaryButton: {
        marginTop: 24,
        backgroundColor: colors.primary,
        paddingVertical: 12,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: colors.buttonText,
        fontWeight: '700',
        fontSize: 15,
    },
});
