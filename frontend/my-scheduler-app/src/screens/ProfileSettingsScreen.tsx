// src/screens/ProfileSettingsScreen.tsx
import React, { useContext, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    Pressable,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';

import { changePasswordSchema } from '../validation/schemas';
import { AuthContext } from '../context/AuthContext';
import { colors } from '../theme/colors';

type Form = z.infer<typeof changePasswordSchema>;

export default function ProfileSettingsScreen() {
    const { changePassword, user, logout } = useContext(AuthContext);

    const [apiError, setApiError] = useState('');
    const [success, setSuccess] = useState('');

    const {
        setValue,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<Form>({
        resolver: zodResolver(changePasswordSchema),
    });

    const displayName = user?.display_name || user?.username || 'Your profile';
    const email = user?.user_email || '';
    const roleLabel = (user?.role || 'employee').toString();
    const mainLocation = user?.location_name || 'Assigned location';

    const initials = (() => {
        const base = displayName.trim();
        if (!base) return 'ME';
        const parts = base.split(/\s+/);
        const letters = parts.map((p) => p[0]).join('');
        return letters.slice(0, 2).toUpperCase();
    })();

    const onSubmit = async (data: Form) => {
        try {
            setApiError('');
            setSuccess('');
            await changePassword(data);
            setSuccess('Password changed. You will be logged out.');
        } catch (e: any) {
            const msg =
                e?.response?.data?.error ||
                e?.response?.data?.message ||
                'Change failed. Please try again.';
            setApiError(msg);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header / avatar */}
                <View style={styles.headerRow}>
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.name}>{displayName}</Text>
                        {!!email && <Text style={styles.email}>{email}</Text>}

                        <View style={styles.roleRow}>
                            <View style={styles.rolePill}>
                                <Ionicons
                                    name="shield-checkmark-outline"
                                    size={14}
                                    color={colors.buttonText}
                                />
                                <Text style={styles.rolePillText}>
                                    {roleLabel.toUpperCase()}
                                </Text>
                            </View>
                            <Text style={styles.locationText}>{mainLocation}</Text>
                        </View>
                    </View>
                </View>

                {/* Account details (read-only) */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Account details</Text>

                    <Text style={styles.label}>Name</Text>
                    <View style={styles.readonlyBox}>
                        <Text style={styles.readonlyText}>{displayName}</Text>
                    </View>

                    <Text style={styles.label}>Email</Text>
                    <View style={styles.readonlyBox}>
                        <Text style={styles.readonlyText}>
                            {email || 'No email on file'}
                        </Text>
                    </View>

                    <Text style={styles.label}>Role</Text>
                    <View style={styles.readonlyBox}>
                        <Text style={styles.readonlyText}>{roleLabel}</Text>
                    </View>

                    <Text style={styles.label}>Primary location</Text>
                    <View style={styles.readonlyBox}>
                        <Text style={styles.readonlyText}>{mainLocation}</Text>
                    </View>
                </View>

                {/* Change password */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Change password</Text>

                    <Text style={styles.label}>Current password</Text>
                    <TextInput
                        secureTextEntry
                        onChangeText={(v) => setValue('current_password', v)}
                        style={[
                            styles.input,
                            errors.current_password && styles.inputError,
                        ]}
                        placeholder="••••••••"
                        placeholderTextColor={colors.gray}
                    />
                    {errors.current_password && (
                        <Text style={styles.errorText}>
                            {errors.current_password.message}
                        </Text>
                    )}

                    <Text style={styles.label}>New password</Text>
                    <TextInput
                        secureTextEntry
                        onChangeText={(v) => setValue('new_password', v)}
                        style={[
                            styles.input,
                            errors.new_password && styles.inputError,
                        ]}
                        placeholder="At least 8 characters"
                        placeholderTextColor={colors.gray}
                    />
                    {errors.new_password && (
                        <Text style={styles.errorText}>
                            {errors.new_password.message}
                        </Text>
                    )}

                    <Text style={styles.label}>Confirm new password</Text>
                    <TextInput
                        secureTextEntry
                        onChangeText={(v) => setValue('confirm_password', v)}
                        style={[
                            styles.input,
                            errors.confirm_password && styles.inputError,
                        ]}
                        placeholder="Repeat new password"
                        placeholderTextColor={colors.gray}
                    />
                    {errors.confirm_password && (
                        <Text style={styles.errorText}>
                            {errors.confirm_password.message}
                        </Text>
                    )}

                    {success ? (
                        <Text style={styles.successText}>{success}</Text>
                    ) : null}
                    {apiError ? (
                        <Text style={styles.errorText}>{apiError}</Text>
                    ) : null}

                    <Pressable
                        onPress={handleSubmit(onSubmit)}
                        disabled={isSubmitting}
                        style={({ pressed }) => [
                            styles.primaryButton,
                            isSubmitting && { opacity: 0.7 },
                            pressed && !isSubmitting && { opacity: 0.9 },
                        ]}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color={colors.buttonText} />
                        ) : (
                            <Text style={styles.primaryButtonText}>
                                Change password
                            </Text>
                        )}
                    </Pressable>
                </View>

                {/* Logout */}
                <Pressable
                    onPress={logout}
                    style={({ pressed }) => [
                        styles.logoutButton,
                        pressed && { opacity: 0.9 },
                    ]}
                >
                    <Ionicons
                        name="log-out-outline"
                        size={18}
                        color={colors.primary}
                        style={{ marginRight: 6 }}
                    />
                    <Text style={styles.logoutText}>Log out</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1 },

    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#E5DEFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.primary,
    },
    name: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
    },
    email: {
        fontSize: 13,
        color: colors.gray,
        marginTop: 2,
    },
    roleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 8,
    },
    rolePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: colors.primary,
    },
    rolePillText: {
        color: colors.buttonText,
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    locationText: {
        fontSize: 12,
        color: colors.gray,
    },

    card: {
        backgroundColor: colors.background,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#00000010',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 8,
    },

    label: {
        fontSize: 13,
        color: colors.text,
        marginBottom: 4,
        marginTop: 6,
    },
    readonlyBox: {
        borderWidth: 1,
        borderColor: colors.inputBorder,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: '#F9FAFB',
    },
    readonlyText: {
        fontSize: 14,
        color: colors.text,
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
    inputError: {
        borderColor: '#f97373',
    },
    errorText: {
        marginTop: 2,
        fontSize: 12,
        color: '#f97373',
    },
    successText: {
        marginTop: 8,
        fontSize: 12,
        color: '#16a34a',
    },

    primaryButton: {
        marginTop: 14,
        borderRadius: 999,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    primaryButtonText: {
        color: colors.buttonText,
        fontWeight: '700',
        fontSize: 15,
    },

    logoutButton: {
        marginTop: 4,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    logoutText: {
        color: colors.primary,
        fontWeight: '600',
        fontSize: 13,
    },
});
