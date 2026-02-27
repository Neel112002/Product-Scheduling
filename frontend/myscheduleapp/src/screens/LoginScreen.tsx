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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { colors } from '../theme/colors';

export default function LoginScreen({ navigation }: any) {
    const { login } = useContext(AuthContext);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleLogin = async () => {
        const trimmedEmail = email.trim();

        if (!trimmedEmail || !password) {
            Alert.alert('Missing info', 'Please enter both email and password.');
            return;
        }

        setSubmitting(true);
        try {
            await login(trimmedEmail, password);
            // No manual navigation needed: RootNavigator will switch to App stack
        } catch (err: any) {
            console.error('[LoginScreen] login error:', err);
            const msg =
                err?.graphQLErrors?.[0]?.message ||
                err?.message ||
                'Login failed. Please check your credentials and try again.';
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
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Welcome back</Text>
                        <Text style={styles.subtitle}>
                            Sign in to manage your shifts and schedule.
                        </Text>
                    </View>

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
                        />

                        <Text style={styles.label}>Password</Text>
                        <TextInput
                            style={styles.input}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="••••••••"
                            secureTextEntry
                            autoCapitalize="none"
                            placeholderTextColor={colors.gray}
                        />

                        <Pressable
                            onPress={() =>
                                navigation.navigate?.('ForgotPasswordRequest')
                            }
                            style={styles.forgotLink}
                        >
                            <Text style={styles.forgotText}>Forgot password?</Text>
                        </Pressable>

                        <Pressable
                            onPress={handleLogin}
                            disabled={submitting}
                            style={({ pressed }) => [
                                styles.primaryButton,
                                submitting && { opacity: 0.6 },
                                pressed && !submitting && { opacity: 0.9 },
                            ]}
                        >
                            {submitting ? (
                                <ActivityIndicator color={colors.buttonText} />
                            ) : (
                                <Text style={styles.primaryButtonText}>Sign in</Text>
                            )}
                        </Pressable>
                    </View>
                </View>
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
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 40,
    },
    header: {
        marginBottom: 32,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.text,
    },
    subtitle: {
        marginTop: 4,
        fontSize: 13,
        color: colors.gray,
    },
    card: {
        backgroundColor: colors.background,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#00000010',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    label: {
        fontSize: 13,
        color: colors.text,
        marginBottom: 4,
        marginTop: 8,
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
    forgotLink: {
        alignSelf: 'flex-end',
        marginTop: 8,
        marginBottom: 16,
    },
    forgotText: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '600',
    },
    primaryButton: {
        marginTop: 4,
        borderRadius: 999,
        backgroundColor: colors.primary,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: colors.buttonText,
        fontWeight: '700',
        fontSize: 15,
    },
});
