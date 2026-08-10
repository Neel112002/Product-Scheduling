// src/screens/ProfileSettingsScreen.tsx
import React, {
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    ScrollView,
    Alert,
    ActivityIndicator,
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { AuthContext } from '../context/AuthContext';
import { AuthAPI } from '../api/api';
import {
    isBiometricAvailable,
    isBiometricEnabled,
    setBiometricEnabled,
    getBiometricType,
} from '../utils/biometrics';

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProfileSettingsScreen({ navigation }: any) {
    const { user, setUser, logout } = useContext(AuthContext);

    // ── Display name ──────────────────────────────────────────────────────────
    const [displayName, setDisplayName] = useState(user?.display_name ?? '');
    const [savingName, setSavingName] = useState(false);
    const [nameEditing, setNameEditing] = useState(false);

    // ── Password ──────────────────────────────────────────────────────────────
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPass, setShowCurrentPass] = useState(false);
    const [showNewPass, setShowNewPass] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);

    // ── Biometric ─────────────────────────────────────────────────────────────
    const [bioSupported, setBioSupported] = useState(false);
    const [bioEnabled, setBioEnabledState] = useState(false);
    const [bioType, setBioType] = useState<'face' | 'fingerprint' | 'none'>('none');

    // ── Load biometric state ──────────────────────────────────────────────────
    useEffect(() => {
        const loadBio = async () => {
            const supported = await isBiometricAvailable();
            const enabled = await isBiometricEnabled();
            const type = await getBiometricType();
            setBioSupported(supported);
            setBioEnabledState(enabled);
            setBioType(type);
        };
        loadBio();
    }, []);

    const handleBioToggle = async (value: boolean) => {
        setBioEnabledState(value);
        await setBiometricEnabled(value);
        Alert.alert(
            value ? 'Biometric Login Enabled' : 'Biometric Login Disabled',
            value
                ? 'You will be prompted for biometric verification next time you open the app.'
                : 'The app will log you in automatically without biometric verification.'
        );
    };

    // ── Save display name ─────────────────────────────────────────────────────
    const handleSaveName = async () => {
        if (!displayName.trim()) {
            Alert.alert('Invalid name', 'Display name cannot be empty.');
            return;
        }
        setSavingName(true);
        try {
            const { data } = await AuthAPI.updateProfile(displayName.trim());
            setUser((prev: any) => prev
                ? { ...prev, display_name: data.display_name ?? displayName.trim() }
                : prev
            );
            setNameEditing(false);
            Alert.alert('Saved ✓', 'Your name has been updated.');
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to update name.');
        } finally {
            setSavingName(false);
        }
    };

    // ── Change password ───────────────────────────────────────────────────────
    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert('Missing fields', 'Please fill in all password fields.');
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert('Password mismatch', 'New passwords do not match.');
            return;
        }
        if (newPassword.length < 6) {
            Alert.alert('Too short', 'Password must be at least 6 characters.');
            return;
        }
        setSavingPassword(true);
        try {
            await AuthAPI.changePassword({
                current_password: currentPassword,
                new_password: newPassword,
                confirm_password: confirmPassword,
            });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            Alert.alert('Password changed ✓', 'Your password has been updated.');
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to change password.');
        } finally {
            setSavingPassword(false);
        }
    };

    // ── Logout ────────────────────────────────────────────────────────────────
    const handleLogout = () => {
        Alert.alert('Sign out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign out',
                style: 'destructive',
                onPress: logout,
            },
        ]);
    };

    const name = user?.display_name || user?.username || 'User';
    const initials = name.trim().split(/\s+/).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
    const bioLabel = bioType === 'face' ? 'Face ID' : 'Fingerprint';

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>

            {/* Header */}
            <View style={styles.header}>
                {navigation.canGoBack() ? (
                    <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color={colors.text} />
                    </Pressable>
                ) : (
                    <View style={{ width: 36 }} />
                )}
                <Text style={styles.headerTitle}>Profile Settings</Text>
                <View style={{ width: 36 }} />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Avatar ── */}
                <View style={styles.avatarSection}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <Text style={styles.avatarName}>{name}</Text>
                    <Text style={styles.avatarEmail}>{user?.user_email ?? ''}</Text>
                    <View style={styles.rolePill}>
                        <Text style={styles.roleText}>{user?.role?.name ?? 'Staff'}</Text>
                    </View>
                </View>

                {/* ── Display name ── */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Display Name</Text>
                        {!nameEditing && (
                            <Pressable
                                onPress={() => setNameEditing(true)}
                                style={styles.editBtn}
                            >
                                <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                                <Text style={styles.editBtnText}>Edit</Text>
                            </Pressable>
                        )}
                    </View>

                    {nameEditing ? (
                        <>
                            <TextInput
                                style={styles.input}
                                value={displayName}
                                onChangeText={setDisplayName}
                                placeholder="Your display name"
                                placeholderTextColor={colors.gray}
                                autoFocus
                            />
                            <View style={styles.actionRow}>
                                <Pressable
                                    style={styles.cancelBtn}
                                    onPress={() => {
                                        setDisplayName(user?.display_name ?? '');
                                        setNameEditing(false);
                                    }}
                                >
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.saveBtn, savingName && { opacity: 0.6 }]}
                                    onPress={handleSaveName}
                                    disabled={savingName}
                                >
                                    {savingName
                                        ? <ActivityIndicator size="small" color="#fff" />
                                        : <Text style={styles.saveBtnText}>Save</Text>
                                    }
                                </Pressable>
                            </View>
                        </>
                    ) : (
                        <Text style={styles.fieldValue}>
                            {user?.display_name || 'Not set'}
                        </Text>
                    )}
                </View>

                {/* ── Account info ── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Account Info</Text>
                    <InfoRow
                        icon="mail-outline"
                        label="Email"
                        value={user?.user_email ?? '—'}
                    />
                    <InfoRow
                        icon="person-outline"
                        label="Username"
                        value={user?.username ?? '—'}
                    />
                    <InfoRow
                        icon="shield-outline"
                        label="Role"
                        value={user?.role?.name ?? '—'}
                    />
                </View>

                {/* ── Security — Biometric toggle ── */}
                {bioSupported && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Security</Text>

                        <View style={styles.bioRow}>
                            <View style={[
                                styles.bioIconWrap,
                                {
                                    backgroundColor: bioEnabled
                                        ? colors.primary + '15'
                                        : '#F3F4F6'
                                },
                            ]}>
                                <Ionicons
                                    name={bioType === 'face'
                                        ? 'scan-outline'
                                        : 'finger-print-outline'}
                                    size={22}
                                    color={bioEnabled ? colors.primary : colors.gray}
                                />
                            </View>
                            <View style={styles.bioInfo}>
                                <Text style={styles.bioLabel}>{bioLabel} Login</Text>
                                <Text style={styles.bioSub}>
                                    {bioEnabled
                                        ? `${bioLabel} required to open app`
                                        : `${bioLabel} login is disabled`}
                                </Text>
                            </View>
                            <Switch
                                value={bioEnabled}
                                onValueChange={handleBioToggle}
                                trackColor={{ true: colors.primary, false: '#E5E7EB' }}
                                thumbColor="#fff"
                            />
                        </View>
                    </View>
                )}

                {/* ── Change password ── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Change Password</Text>

                    <Text style={styles.inputLabel}>Current password</Text>
                    <View style={styles.inputWrap}>
                        <Ionicons name="lock-closed-outline" size={16} color={colors.gray} />
                        <TextInput
                            style={styles.inputInner}
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            placeholder="Enter current password"
                            placeholderTextColor={colors.gray}
                            secureTextEntry={!showCurrentPass}
                        />
                        <Pressable onPress={() => setShowCurrentPass(p => !p)}>
                            <Ionicons
                                name={showCurrentPass ? 'eye-off-outline' : 'eye-outline'}
                                size={16}
                                color={colors.gray}
                            />
                        </Pressable>
                    </View>

                    <Text style={styles.inputLabel}>New password</Text>
                    <View style={styles.inputWrap}>
                        <Ionicons name="lock-open-outline" size={16} color={colors.gray} />
                        <TextInput
                            style={styles.inputInner}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder="Min. 6 characters"
                            placeholderTextColor={colors.gray}
                            secureTextEntry={!showNewPass}
                        />
                        <Pressable onPress={() => setShowNewPass(p => !p)}>
                            <Ionicons
                                name={showNewPass ? 'eye-off-outline' : 'eye-outline'}
                                size={16}
                                color={colors.gray}
                            />
                        </Pressable>
                    </View>

                    <Text style={styles.inputLabel}>Confirm new password</Text>
                    <View style={[
                        styles.inputWrap,
                        confirmPassword && newPassword !== confirmPassword
                        && { borderColor: colors.error },
                    ]}>
                        <Ionicons name="lock-open-outline" size={16} color={colors.gray} />
                        <TextInput
                            style={styles.inputInner}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Repeat new password"
                            placeholderTextColor={colors.gray}
                            secureTextEntry
                        />
                    </View>
                    {confirmPassword && newPassword !== confirmPassword && (
                        <Text style={styles.errorText}>Passwords do not match</Text>
                    )}

                    <Pressable
                        style={[styles.changePassBtn, savingPassword && { opacity: 0.6 }]}
                        onPress={handleChangePassword}
                        disabled={savingPassword}
                    >
                        {savingPassword
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={styles.changePassBtnText}>Update Password</Text>
                        }
                    </Pressable>
                </View>

                {/* ── Sign out ── */}
                <Pressable style={styles.logoutBtn} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color={colors.error} />
                    <Text style={styles.logoutText}>Sign Out</Text>
                </Pressable>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ── InfoRow ───────────────────────────────────────────────────────────────────

function InfoRow({
    icon,
    label,
    value,
}: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    value: string;
}) {
    return (
        <View style={infoStyles.row}>
            <View style={infoStyles.iconWrap}>
                <Ionicons name={icon} size={16} color={colors.primary} />
            </View>
            <View style={infoStyles.content}>
                <Text style={infoStyles.label}>{label}</Text>
                <Text style={infoStyles.value}>{value}</Text>
            </View>
        </View>
    );
}

const infoStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    iconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.subtleAccent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: { flex: 1 },
    label: { fontSize: 11, color: colors.gray },
    value: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 1 },
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8F8FC' },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 40 },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backBtn: { padding: 4, marginRight: 8 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },

    // Avatar section
    avatarSection: {
        alignItems: 'center',
        paddingVertical: 24,
        gap: 6,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        shadowColor: colors.primary,
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 6,
    },
    avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
    avatarName: { fontSize: 20, fontWeight: '800', color: colors.text },
    avatarEmail: { fontSize: 13, color: colors.gray },
    rolePill: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: colors.primary + '15',
        marginTop: 4,
    },
    roleText: { fontSize: 12, color: colors.primary, fontWeight: '700' },

    // Cards
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#EFEFEF',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    editBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    editBtnText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
    fieldValue: { fontSize: 14, color: colors.text, marginTop: 4 },

    // Name edit
    input: {
        borderWidth: 1,
        borderColor: colors.inputBorder,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: colors.text,
        backgroundColor: '#FAFAFA',
        marginBottom: 10,
    },
    actionRow: { flexDirection: 'row', gap: 10 },
    cancelBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        alignItems: 'center',
    },
    cancelBtnText: { fontSize: 13, color: colors.text, fontWeight: '600' },
    saveBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: colors.primary,
        alignItems: 'center',
    },
    saveBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },

    // ✅ Biometric row
    bioRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 4,
    },
    bioIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bioInfo: { flex: 1 },
    bioLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    bioSub: { fontSize: 12, color: colors.gray, marginTop: 2 },

    // Password
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 6,
        marginTop: 8,
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#FAFAFA',
        marginBottom: 4,
    },
    inputInner: { flex: 1, fontSize: 14, color: colors.text },
    errorText: { fontSize: 11, color: colors.error, marginBottom: 8, marginLeft: 4 },

    changePassBtn: {
        backgroundColor: colors.primary,
        borderRadius: 999,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 14,
    },
    changePassBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    // Logout
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: colors.error,
        backgroundColor: colors.error + '08',
        marginTop: 4,
    },
    logoutText: { fontSize: 15, fontWeight: '700', color: colors.error },
});