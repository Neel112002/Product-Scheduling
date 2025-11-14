// src/screens/LoginScreen.tsx
import React, { useContext, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Image,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { loginSchema } from '../validation/schemas';
import { AuthContext } from '../context/AuthContext';

type Form = z.infer<typeof loginSchema>;

const PURPLE = '#7B4AE2';

export default function LoginScreen({ navigation }: any) {
    const { login } = useContext(AuthContext);
    const [apiError, setApiError] = useState('');
    const { setValue, handleSubmit, formState: { errors, isSubmitting } } =
        useForm<Form>({ resolver: zodResolver(loginSchema) });

    const onSubmit = async (data: Form) => {
        try {
            setApiError('');
            await login(data.email, data.password);
        } catch (e: any) {
            const msg =
                e?.response?.data?.error ||
                e?.response?.data?.message ||
                (typeof e?.response?.data === 'string' ? e.response.data : '') ||
                e?.message ||
                'Login failed';
            setApiError(msg);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.card}>
                <Image
                    source={require('../../assets/logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />

                <Text style={styles.title}>Welcome Back!</Text>
                <Text style={styles.subtitle}>Sign in to continue</Text>

                <View style={{ marginTop: 30, width: '100%' }}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={styles.input}
                        onChangeText={(v) => setValue('email', v)}
                    />
                    {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}

                    <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
                    <TextInput
                        secureTextEntry
                        style={styles.input}
                        onChangeText={(v) => setValue('password', v)}
                    />
                    {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}

                    {apiError ? <Text style={styles.error}>{apiError}</Text> : null}

                    <TouchableOpacity
                        style={styles.forgotButton}
                        onPress={() => navigation.navigate('ForgotPasswordRequest')}
                    >
                        <Text style={styles.forgotText}>Forgot Password?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.signInButton}
                        onPress={handleSubmit(onSubmit)}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.signInText}>Sign In</Text>
                        )}
                    </TouchableOpacity>

                    {/* ❗ Only Owner Signup remains */}
                    <View style={styles.ownerContainer}>
                        <Text style={styles.grayText}>Own a store or café? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('OwnerSignup')}>
                            <Text style={styles.ownerText}>Create a company account</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f8ff',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 28,
        width: '100%',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 4,
        alignItems: 'center',
    },
    logo: { width: 90, height: 90 },
    title: {
        fontSize: 22,
        fontWeight: '600',
        color: PURPLE,
        marginTop: 16,
    },
    subtitle: { color: '#777', fontSize: 14, marginTop: 4 },
    label: { color: '#444', fontSize: 14, fontWeight: '500' },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 10,
        marginTop: 6,
    },
    signInButton: {
        backgroundColor: PURPLE,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 24,
    },
    signInText: { color: '#fff', fontWeight: '600', fontSize: 16 },
    forgotButton: { marginTop: 10, alignSelf: 'flex-end' },
    forgotText: { color: PURPLE, fontSize: 13 },
    grayText: { color: '#666' },
    ownerContainer: {
        flexDirection: 'row',
        marginTop: 24,
        justifyContent: 'center',
    },
    ownerText: { color: PURPLE, fontWeight: '600' },
    error: { color: 'red', marginTop: 4, fontSize: 13 },
});
