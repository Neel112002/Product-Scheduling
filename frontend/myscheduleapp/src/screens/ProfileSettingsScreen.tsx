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
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { AuthContext }  from '../context/AuthContext';
import { colors }       from '../theme/colors';
import { AuthAPI }      from '../api/api';

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProfileSettingsScreen({ navigation }: any) {
    const { user, setUser, logout } = useContext(AuthContext);

    // ── Display name editing ──────────────────────────────────────────────────
    const [displayName,      setDisplayName]      = useState(user?.display_name ?? '');
    const [savingName,       setSavingName]       = useState(false);
    const [nameEditing,      setNameEditing]      = useState(false);

    // ── Password change ───────────────────────────────────────────────────────
    const [currentPassword,  setCurrentPassword]  = useState('');
    const [newPassword,      setNewPassword]      = useState('');
    const [confirmPassword,  setConfirmPassword]  = useState('');
    const [savingPassword,   setSavingPassword]   = useState(false);
    const [showCurrent,      setShowCurrent]      = useState(false);
    const [showNew,          setShowNew]          = useState(false);
    const [showConfirm,      setShowConfirm]      = useState(false);

    // ── Derived display values ────────────────────────────────────────────────
    const shownName   = user?.display_name || user?.username || 'Your profile';
    const email       = user?.user_email   ?? '';
    const roleName    = user?.role?.name   ?? 'Employee';
    const locationName = user?.primaryLocation?.name ?? 'Assigned location';

    const initials = shownName
        .trim()
        .split(/\s+/)
        .map((p: string) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    // ── Save display name ─────────────────────────────────────────────────────
    const handleSaveName = async () => {
        if (!displayName.trim()) {
            Alert.alert('Error', 'Display name cannot be empty.');
            return;
        }
        setSavingName(true);
        try {
            const { data } = await AuthAPI.updateProfile(displayName.trim());
            // Update local auth context so header reflects change immediately
            if (data?.user) {
                setUser(prev => prev ? {
                    ...prev,
                    display_name: data.user.display_name,
                } : prev);
            }
            setNameEditing(false);
            Alert.alert('Updated ✓', 'Your display name has been updated.');
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to update name.');
        } finally {
            setSavingName(false);
        }
    };

    // ── Change password ───────────────────────────────────────────────────────
    const handleChangePassword = async () => {
        if (!currentPassword) {
            Alert.alert('Error', 'Please enter your current password.');
            return;
        }
        if (newPassword.length < 8) {
            Alert.alert('Error', 'New password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'New passwords do not match.');
            return;
        }
        if (currentPassword === newPassword) {
            Alert.alert('Error', 'New password must be different from current password.');
            return;
        }

        setSavingPassword(true);
        try {
            await AuthAPI.changePassword({
                current_password: currentPassword,
                new_password:     newPassword,
                confirm_password: confirmPassword,
            });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            Alert.alert(
                'Password Changed ✓',
                'Your password has been updated. Please log in again on other devices.',
            );
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to change password.');
        } finally {
            setSavingPassword(false);
        }
    };

    // ── Logout ────────────────────────────────────────────────────────────────
    const handleLogout = () => {
        Alert.alert(
            'Log out',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log out', style: 'destructive', onPress: logout },
            ]
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>

            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Profile Settings</Text>
                <View style={{ width: 36 }} />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* ── Avatar + name ── */}
                <View style={styles.avatarSection}>
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <Text style={styles.avatarName}>{shownName}</Text>
                    <Text style={styles.avatarEmail}>{email}</Text>
                    <View style={styles.rolePill}>
                        <Ionicons name="shield-checkmark-outline" size={13} color={colors.primary} />
                        <Text style={styles.rolePillText}>{roleName}</Text>
                    </View>
                </View>

                {/* ── Account info ── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Account Information</Text>

                    <InfoRow icon="mail-outline"     label="Email"    value={email || '—'} />
                    <InfoRow icon="shield-outline"   label="Role"     value={roleName} />
                    <InfoRow icon="location-outline" label="Location" value={locationName} />
                </View>

                {/* ── Edit display name ── */}
                <View style={styles.card}>
                    <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle}>Display Name</Text>
                        {!nameEditing && (
                            <Pressable
                                onPress={() => {
                                    setDisplayName(user?.display_name ?? '');
                                    setNameEditing(true);
                                }}
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
                                placeholder="e.g. John Doe"
                                placeholderTextColor={colors.gray}
                                autoFocus
                                maxLength={60}
                            />
                            <Text style={styles.charCount}>{displayName.length}/60</Text>
                            <View style={styles.btnRow}>
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
                        <View style={styles.readonlyBox}>
                            <Text style={styles.readonlyText}>
                                {user?.display_name || 'Not set — tap Edit to add your name'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* ── Change password ── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Change Password</Text>

                    <Text style={styles.fieldLabel}>Current password</Text>
                    <View style={styles.passwordRow}>
                        <TextInput
                            style={[styles.input, { flex: 1 }]}
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            placeholder="••••••••"
                            placeholderTextColor={colors.gray}
                            secureTextEntry={!showCurrent}
                            autoCapitalize="none"
                        />
                        <Pressable
                            onPress={() => setShowCurrent(p => !p)}
                            style={styles.eyeBtn}
                        >
                            <Ionicons
                                name={showCurrent ? 'eye-off-outline' : 'eye-outline'}
                                size={20}
                                color={colors.gray}
                            />
                        </Pressable>
                    </View>

                    <Text style={[styles.fieldLabel, { marginTop: 12 }]}>New password</Text>
                    <View style={styles.passwordRow}>
                        <TextInput
                            style={[styles.input, { flex: 1 }]}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder="At least 8 characters"
                            placeholderTextColor={colors.gray}
                            secureTextEntry={!showNew}
                            autoCapitalize="none"
                        />
                        <Pressable
                            onPress={() => setShowNew(p => !p)}
                            style={styles.eyeBtn}
                        >
                            <Ionicons
                                name={showNew ? 'eye-off-outline' : 'eye-outline'}
                                size={20}
                                color={colors.gray}
                            />
                        </Pressable>
                    </View>

                    {/* Password strength */}
                    {newPassword.length > 0 && (
                        <PasswordStrength password={newPassword} />
                    )}

                    <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Confirm new password</Text>
                    <View style={styles.passwordRow}>
                        <TextInput
                            style={[
                                styles.input,
                                { flex: 1 },
                                confirmPassword.length > 0 && confirmPassword !== newPassword
                                    && { borderColor: colors.error },
                            ]}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Repeat new password"
                            placeholderTextColor={colors.gray}
                            secureTextEntry={!showConfirm}
                            autoCapitalize="none"
                        />
                        <Pressable
                            onPress={() => setShowConfirm(p => !p)}
                            style={styles.eyeBtn}
                        >
                            <Ionicons
                                name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                                size={20}
                                color={colors.gray}
                            />
                        </Pressable>
                    </View>

                    {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                        <Text style={styles.errorText}>Passwords do not match</Text>
                    )}

                    <Pressable
                        style={[styles.primaryBtn, savingPassword && { opacity: 0.6 }]}
                        onPress={handleChangePassword}
                        disabled={savingPassword}
                    >
                        {savingPassword
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.primaryBtnText}>Update Password</Text>
                        }
                    </Pressable>
                </View>

                {/* ── Danger zone ── */}
                <View style={styles.dangerCard}>
                    <Pressable style={styles.logoutRow} onPress={handleLogout}>
                        <View style={styles.logoutIconWrap}>
                            <Ionicons name="log-out-outline" size={20} color={colors.error} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.logoutTitle}>Log out</Text>
                            <Text style={styles.logoutSubtitle}>
                                You'll need to sign in again
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.gray} />
                    </Pressable>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({
    icon,
    label,
    value,
}: {
    icon:  React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    value: string;
}) {
    return (
        <View style={infoStyles.row}>
            <View style={infoStyles.iconWrap}>
                <Ionicons name={icon} size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={infoStyles.label}>{label}</Text>
                <Text style={infoStyles.value}>{value}</Text>
            </View>
        </View>
    );
}

function PasswordStrength({ password }: { password: string }) {
    let score = 0;
    if (password.length >= 8)         score++;
    if (/[A-Z]/.test(password))       score++;
    if (/[0-9]/.test(password))       score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const labels = ['Weak', 'Fair', 'Good', 'Strong'];
    const colors_ = [colors.error, colors.warning, colors.info, colors.success];

    return (
        <View style={pwStyles.wrap}>
            <View style={pwStyles.bars}>
                {[0, 1, 2, 3].map(i => (
                    <View
                        key={i}
                        style={[
                            pwStyles.bar,
                            { backgroundColor: i < score ? colors_[score - 1] : '#E5E7EB' },
                        ]}
                    />
                ))}
            </View>
            <Text style={[pwStyles.label, { color: colors_[score - 1] ?? colors.gray }]}>
                {labels[score - 1] ?? ''}
            </Text>
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:    { flex: 1, backgroundColor: '#F8F8FC' },
    scroll:  { flex: 1 },
    content: { padding: 16 },

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
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },

    avatarSection: {
        alignItems:    'center',
        paddingVertical: 24,
        gap:           6,
        marginBottom:  8,
    },
    avatarCircle: {
        width:           80,
        height:          80,
        borderRadius:    40,
        backgroundColor: colors.primary,
        alignItems:      'center',
        justifyContent:  'center',
        marginBottom:    8,
        shadowColor:     colors.primary,
        shadowOpacity:   0.3,
        shadowRadius:    8,
        elevation:       4,
    },
    avatarText:  { fontSize: 28, fontWeight: '800', color: '#fff' },
    avatarName:  { fontSize: 20, fontWeight: '800', color: colors.text },
    avatarEmail: { fontSize: 13, color: colors.gray },
    rolePill: {
        flexDirection:     'row',
        alignItems:        'center',
        gap:               4,
        paddingHorizontal: 12,
        paddingVertical:    4,
        borderRadius:      999,
        backgroundColor:   colors.subtleAccent,
        borderWidth:       1,
        borderColor:       colors.primary + '30',
    },
    rolePillText: { fontSize: 12, color: colors.primary, fontWeight: '700' },

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
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
    cardTitleRow: {
        flexDirection:  'row',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   12,
    },
    editBtn: {
        flexDirection: 'row',
        alignItems:    'center',
        gap:           4,
        paddingHorizontal: 10,
        paddingVertical:    5,
        borderRadius:  999,
        backgroundColor: colors.subtleAccent,
    },
    editBtnText: { fontSize: 12, color: colors.primary, fontWeight: '600' },

    readonlyBox: {
        borderWidth:       1,
        borderColor:       '#EFEFEF',
        borderRadius:      10,
        paddingHorizontal: 12,
        paddingVertical:   10,
        backgroundColor:   '#FAFAFA',
    },
    readonlyText: { fontSize: 14, color: colors.text },

    fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },

    input: {
        borderWidth:       1,
        borderColor:       colors.inputBorder,
        borderRadius:      10,
        paddingHorizontal: 12,
        paddingVertical:   10,
        fontSize:          14,
        color:             colors.text,
        backgroundColor:   '#FAFAFA',
    },
    charCount: { fontSize: 11, color: colors.gray, textAlign: 'right', marginTop: 4 },

    passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    eyeBtn:      { padding: 8 },

    errorText: { fontSize: 12, color: colors.error, marginTop: 4 },

    btnRow: {
        flexDirection: 'row',
        gap:           10,
        marginTop:     12,
    },
    cancelBtn: {
        flex:          1,
        paddingVertical: 10,
        borderRadius:  999,
        borderWidth:   1,
        borderColor:   colors.inputBorder,
        alignItems:    'center',
    },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.text },
    saveBtn: {
        flex:            1,
        paddingVertical: 10,
        borderRadius:    999,
        backgroundColor: colors.primary,
        alignItems:      'center',
    },
    saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

    primaryBtn: {
        marginTop:       16,
        paddingVertical: 13,
        borderRadius:    999,
        backgroundColor: colors.primary,
        alignItems:      'center',
        shadowColor:     colors.primary,
        shadowOpacity:   0.2,
        shadowRadius:    6,
        elevation:       3,
    },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

    dangerCard: {
        backgroundColor: '#fff',
        borderRadius:    16,
        marginBottom:    12,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        overflow:        'hidden',
    },
    logoutRow: {
        flexDirection:     'row',
        alignItems:        'center',
        paddingHorizontal: 16,
        paddingVertical:   14,
        gap:               12,
    },
    logoutIconWrap: {
        width:          40,
        height:         40,
        borderRadius:   20,
        backgroundColor: colors.error + '12',
        alignItems:     'center',
        justifyContent: 'center',
    },
    logoutTitle:    { fontSize: 15, fontWeight: '600', color: colors.error },
    logoutSubtitle: { fontSize: 12, color: colors.gray, marginTop: 1 },
});

const infoStyles = StyleSheet.create({
    row: {
        flexDirection:  'row',
        alignItems:     'center',
        gap:            12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    iconWrap: {
        width:          36,
        height:         36,
        borderRadius:   18,
        backgroundColor: colors.subtleAccent,
        alignItems:     'center',
        justifyContent: 'center',
    },
    label: { fontSize: 11, color: colors.gray, marginBottom: 1 },
    value: { fontSize: 14, fontWeight: '600', color: colors.text },
});

const pwStyles = StyleSheet.create({
    wrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    bars:  { flex: 1, flexDirection: 'row', gap: 4 },
    bar:   { flex: 1, height: 4, borderRadius: 2 },
    label: { fontSize: 12, fontWeight: '700', minWidth: 40 },
});