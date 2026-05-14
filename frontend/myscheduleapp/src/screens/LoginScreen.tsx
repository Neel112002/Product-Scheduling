import React, { useContext, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { colors } from '../theme/colors';

export default function LoginScreen({ navigation }: any) {
    const { login } = useContext(AuthContext);

    const [email,       setEmail]       = useState('');
    const [password,    setPassword]    = useState('');
    const [submitting,  setSubmitting]  = useState(false);

    const handleLogin = async () => {
        const trimmedEmail = email.trim().toLowerCase();

        if (!trimmedEmail || !password) {
            Alert.alert('Missing info', 'Please enter both email and password.');
            return;
        }

        setSubmitting(true);
        try {
            await login(trimmedEmail, password);
            // RootNavigator automatically switches to App stack on success
        } catch (err: any) {
            console.error('[LoginScreen] login error:', err);

            // Handle both REST and GraphQL error shapes
            const msg =
                err?.response?.data?.error     ||
                err?.graphQLErrors?.[0]?.message ||
                err?.message                    ||
                'Login failed. Please check your credentials.';

            Alert.alert('Login failed', msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.container}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Logo / Header */}
                    <View style={styles.header}>
                        <View style={styles.logoCircle}>
                            <Text style={styles.logoText}>S</Text>
                        </View>
                        <Text style={styles.title}>Welcome back</Text>
                        <Text style={styles.subtitle}>
                            Sign in to manage your shifts and schedule.
                        </Text>
                    </View>

                    {/* Form */}
                    <View style={styles.card}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="you@yourcafe.com"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            placeholderTextColor={colors.gray}
                            returnKeyType="next"
                        />

                        <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
                        <TextInput
                            style={styles.input}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="••••••••"
                            secureTextEntry
                            autoCapitalize="none"
                            placeholderTextColor={colors.gray}
                            returnKeyType="done"
                            onSubmitEditing={handleLogin}
                        />

                        <Pressable
                            onPress={() => navigation.navigate('ForgotPasswordRequest')}
                            style={styles.forgotLink}
                        >
                            <Text style={styles.forgotText}>Forgot password?</Text>
                        </Pressable>

                        <Pressable
                            onPress={handleLogin}
                            disabled={submitting}
                            style={({ pressed }) => [
                                styles.primaryButton,
                                submitting       && { opacity: 0.6 },
                                pressed && !submitting && { opacity: 0.85 },
                            ]}
                        >
                            {submitting ? (
                                <ActivityIndicator color={colors.buttonText} />
                            ) : (
                                <Text style={styles.primaryButtonText}>Sign in</Text>
                            )}
                        </Pressable>
                    </View>

                    {/* Divider */}
                    <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Sign up button */}
                    <Pressable
                        onPress={() => navigation.navigate('OwnerSignup')}
                        style={({ pressed }) => [
                            styles.secondaryButton,
                            pressed && { opacity: 0.8 },
                        ]}
                    >
                        <Text style={styles.secondaryButtonText}>
                            Create an owner account
                        </Text>
                    </Pressable>

                    <Text style={styles.staffNote}>
                        Staff members are invited by their manager — no sign up needed.
                    </Text>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: colors.background,
    },
    container: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 40,
    },

    // Header
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        shadowColor: colors.primary,
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    logoText: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '800',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: colors.gray,
        textAlign: 'center',
    },

    // Card
    card: {
        backgroundColor: colors.background,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#00000010',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        marginBottom: 24,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.inputBorder,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: colors.text,
        backgroundColor: '#FAFAFA',
    },
    forgotLink: {
        alignSelf: 'flex-end',
        marginTop: 10,
        marginBottom: 20,
    },
    forgotText: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '600',
    },
    primaryButton: {
        borderRadius: 999,
        backgroundColor: colors.primary,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
    },
    primaryButtonText: {
        color: colors.buttonText,
        fontWeight: '700',
        fontSize: 15,
    },

    // Divider
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E5E7EB',
    },
    dividerText: {
        marginHorizontal: 12,
        fontSize: 12,
        color: colors.gray,
    },

    // Secondary button
    secondaryButton: {
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: colors.primary,
        paddingVertical: 13,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    secondaryButtonText: {
        color: colors.primary,
        fontWeight: '700',
        fontSize: 15,
    },

    staffNote: {
        fontSize: 12,
        color: colors.gray,
        textAlign: 'center',
        lineHeight: 18,
        paddingHorizontal: 16,
    },
});