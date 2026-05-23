// src/screens/auth/LoginScreen.tsx
import React, {
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';

import { AuthContext }  from '../context/AuthContext';
import { colors }       from '../theme/colors';
import {
    isBiometricAvailable,
    isBiometricEnabled,
    getBiometricType,
    authenticateWithBiometrics,
    getStoredToken,
    getStoredUser,
    hasStoredSession,
} from '../utils/biometrics';

// ── Component ─────────────────────────────────────────────────────────────────

export default function LoginScreen({ navigation }: any) {
    const { login, restoreSession } = useContext(AuthContext);

    const [email,      setEmail]      = useState('');
    const [password,   setPassword]   = useState('');
    const [showPass,   setShowPass]   = useState(false);
    const [loading,    setLoading]    = useState(false);
    const [bioLoading, setBioLoading] = useState(false);

    // Biometric state
    const [bioAvailable, setBioAvailable] = useState(false);
    const [bioType,      setBioType]      = useState<'face' | 'fingerprint' | 'none'>('none');
    const [hasSession,   setHasSession]   = useState(false);

    const passwordRef = useRef<TextInput>(null);

    // ── Check biometric on mount ──────────────────────────────────────────────
    useEffect(() => {
        const checkBio = async () => {
            const available = await isBiometricAvailable();
            const enabled   = await isBiometricEnabled();
            const session   = await hasStoredSession();
            const type      = await getBiometricType();

            // Only show biometric if available + enabled by user
            setBioAvailable(available && enabled);
            setHasSession(session);
            setBioType(type);

            // Auto-prompt if all conditions met
            if (available && enabled && session) {
                handleBiometricLogin(true);
            }
        };
        checkBio();
    }, []);

    // ── Biometric login ───────────────────────────────────────────────────────
    const handleBiometricLogin = useCallback(async (isAutoPrompt = false) => {
        setBioLoading(true);
        try {
            const success = await authenticateWithBiometrics(
                'Sign in to your account'
            );

            if (!success) {
                if (!isAutoPrompt) {
                    Alert.alert(
                        'Authentication failed',
                        'Biometric verification failed. Please use your password.'
                    );
                }
                return;
            }

            const storedToken = await getStoredToken();
            const storedUser  = await getStoredUser();

            if (!storedToken || !storedUser) {
                Alert.alert('Session expired', 'Please sign in with your password.');
                return;
            }

            restoreSession(storedToken, storedUser);

        } catch {
            if (!isAutoPrompt) {
                Alert.alert('Error', 'Biometric authentication failed. Please use your password.');
            }
        } finally {
            setBioLoading(false);
        }
    }, [restoreSession]);

    // ── Password login ────────────────────────────────────────────────────────
    const handleLogin = useCallback(async () => {
        if (!email.trim() || !password) {
            Alert.alert('Missing fields', 'Please enter your email and password.');
            return;
        }
        setLoading(true);
        try {
            await login(email.trim().toLowerCase(), password);
        } catch (e: any) {
            Alert.alert(
                'Login failed',
                e?.response?.data?.error || e?.message || 'Please try again.'
            );
        } finally {
            setLoading(false);
        }
    }, [email, password, login]);

    // ── Bio icon ──────────────────────────────────────────────────────────────
    const bioIcon: React.ComponentProps<typeof Ionicons>['name'] =
        bioType === 'face' ? 'scan-outline' : 'finger-print-outline';
    const bioLabel = bioType === 'face' ? 'Face ID' : 'Fingerprint';

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Brand */}
                    <View style={styles.brand}>
                        <View style={styles.logoWrap}>
                            <Ionicons name="calendar-outline" size={36} color="#fff" />
                        </View>
                        <Text style={styles.appName}>MySchedule</Text>
                        <Text style={styles.tagline}>Shift management, simplified</Text>
                    </View>

                    {/* Card */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Welcome back</Text>
                        <Text style={styles.cardSub}>Sign in to your account</Text>

                        {/* Email */}
                        <Text style={styles.label}>Email</Text>
                        <View style={styles.inputWrap}>
                            <Ionicons name="mail-outline" size={18} color={colors.gray} />
                            <TextInput
                                style={styles.input}
                                value={email}
                                onChangeText={setEmail}
                                placeholder="you@company.com"
                                placeholderTextColor={colors.gray}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                autoCorrect={false}
                                returnKeyType="next"
                                onSubmitEditing={() => passwordRef.current?.focus()}
                            />
                        </View>

                        {/* Password */}
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.inputWrap}>
                            <Ionicons name="lock-closed-outline" size={18} color={colors.gray} />
                            <TextInput
                                ref={passwordRef}
                                style={styles.input}
                                value={password}
                                onChangeText={setPassword}
                                placeholder="••••••••"
                                placeholderTextColor={colors.gray}
                                secureTextEntry={!showPass}
                                returnKeyType="done"
                                onSubmitEditing={handleLogin}
                            />
                            <Pressable onPress={() => setShowPass(p => !p)}>
                                <Ionicons
                                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                                    size={18}
                                    color={colors.gray}
                                />
                            </Pressable>
                        </View>

                        {/* Forgot password */}
                        <Pressable
                            style={styles.forgotBtn}
                            onPress={() => navigation.navigate('ForgotPassword')}
                        >
                            <Text style={styles.forgotText}>Forgot password?</Text>
                        </Pressable>

                        {/* Login button */}
                        <Pressable
                            style={[styles.loginBtn, loading && { opacity: 0.7 }]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.loginBtnText}>Sign In</Text>
                            }
                        </Pressable>

                        {/* ✅ Biometric button — only if available + enabled + session */}
                        {bioAvailable && hasSession && (
                            <View style={styles.bioSection}>
                                <View style={styles.bioDivider}>
                                    <View style={styles.bioDividerLine} />
                                    <Text style={styles.bioDividerText}>or</Text>
                                    <View style={styles.bioDividerLine} />
                                </View>

                                <Pressable
                                    style={[styles.bioBtn, bioLoading && { opacity: 0.7 }]}
                                    onPress={() => handleBiometricLogin(false)}
                                    disabled={bioLoading}
                                >
                                    {bioLoading ? (
                                        <ActivityIndicator color={colors.primary} />
                                    ) : (
                                        <>
                                            <Ionicons
                                                name={bioIcon}
                                                size={26}
                                                color={colors.primary}
                                            />
                                            <Text style={styles.bioBtnText}>
                                                Sign in with {bioLabel}
                                            </Text>
                                        </>
                                    )}
                                </Pressable>
                            </View>
                        )}
                    </View>

                    {/* Register */}
                    <View style={styles.registerRow}>
                        <Text style={styles.registerText}>Don't have an account? </Text>
                        <Pressable onPress={() => navigation.navigate('Register')}>
                            <Text style={styles.registerLink}>Create one</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:    { flex: 1, backgroundColor: '#F8F8FC' },
    content: { flexGrow: 1, padding: 24, justifyContent: 'center' },

    brand:   { alignItems: 'center', marginBottom: 32 },
    logoWrap: {
        width:           72,
        height:          72,
        borderRadius:    20,
        backgroundColor: colors.primary,
        alignItems:      'center',
        justifyContent:  'center',
        marginBottom:    12,
        shadowColor:     colors.primary,
        shadowOpacity:   0.35,
        shadowRadius:    12,
        elevation:       8,
    },
    appName: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
    tagline: { fontSize: 13, color: colors.gray, marginTop: 4 },

    card: {
        backgroundColor: '#fff',
        borderRadius:    20,
        padding:         20,
        borderWidth:     1,
        borderColor:     '#EFEFEF',
        shadowColor:     '#000',
        shadowOpacity:   0.06,
        shadowRadius:    12,
        elevation:       4,
        marginBottom:    24,
    },
    cardTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4  },
    cardSub:   { fontSize: 13, color: colors.gray,                    marginBottom: 20 },

    label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },

    inputWrap: {
        flexDirection:     'row',
        alignItems:        'center',
        gap:               10,
        borderWidth:       1,
        borderColor:       colors.inputBorder,
        borderRadius:      12,
        paddingHorizontal: 14,
        paddingVertical:   12,
        backgroundColor:   '#FAFAFA',
        marginBottom:      14,
    },
    input: { flex: 1, fontSize: 14, color: colors.text },

    forgotBtn:  { alignSelf: 'flex-end', marginBottom: 20, marginTop: -6 },
    forgotText: { fontSize: 12, color: colors.primary, fontWeight: '600' },

    loginBtn: {
        backgroundColor: colors.primary,
        borderRadius:    999,
        paddingVertical: 14,
        alignItems:      'center',
        shadowColor:     colors.primary,
        shadowOpacity:   0.3,
        shadowRadius:    8,
        elevation:       4,
    },
    loginBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

    bioSection: { marginTop: 8 },
    bioDivider: {
        flexDirection:  'row',
        alignItems:     'center',
        gap:            10,
        marginVertical: 16,
    },
    bioDividerLine: { flex: 1, height: 1, backgroundColor: '#EFEFEF' },
    bioDividerText: { fontSize: 12, color: colors.gray },

    bioBtn: {
        flexDirection:   'row',
        alignItems:      'center',
        justifyContent:  'center',
        gap:             10,
        paddingVertical: 14,
        borderRadius:    999,
        borderWidth:     1.5,
        borderColor:     colors.primary,
        backgroundColor: colors.subtleAccent,
    },
    bioBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },

    registerRow: {
        flexDirection:  'row',
        justifyContent: 'center',
        alignItems:     'center',
    },
    registerText: { fontSize: 13, color: colors.gray    },
    registerLink: { fontSize: 13, color: colors.primary, fontWeight: '700' },
});