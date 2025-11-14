import React, { useContext, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { AuthContext } from '../context/AuthContext';

export default function ForgotPasswordRequestScreen({ navigation }: any) {
    const { forgotPassword } = useContext(AuthContext);
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        setLoading(true);
        setError('');
        try {
            await forgotPassword(email);
            navigation.navigate('Otp', { email });
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Failed to send reset link');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Recover your password</Text>
            <Text style={styles.subtitle}>Enter your registered email address.</Text>

            <TextInput placeholder="Email" keyboardType="email-address" autoCapitalize="none"
                style={styles.input} onChangeText={setEmail} />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.button} onPress={handleSubmit}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send Code</Text>}
            </TouchableOpacity>
        </View>
    );
}

const PURPLE = '#7B4AE2';
const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
    title: { fontSize: 22, color: PURPLE, fontWeight: '600', marginBottom: 8 },
    subtitle: { color: '#777', marginBottom: 16 },
    input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 16 },
    button: { backgroundColor: PURPLE, borderRadius: 8, alignItems: 'center', paddingVertical: 14 },
    btnText: { color: '#fff', fontWeight: '600' },
    error: { color: 'red', fontSize: 13 },
});
