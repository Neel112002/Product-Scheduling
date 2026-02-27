import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

export default function OtpScreen({ navigation, route }: any) {
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);

    const handleNext = async () => {
        setLoading(true);
        // you can verify OTP with backend here if implemented
        setTimeout(() => {
            setLoading(false);
            navigation.navigate('ResetPassword', { token: otp });
        }, 800);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Enter OTP</Text>
            <Text style={styles.subtitle}>Enter the 6-digit code sent to your email.</Text>

            <TextInput
                style={styles.input}
                keyboardType="numeric"
                maxLength={6}
                placeholder="Enter code"
                onChangeText={setOtp}
                value={otp}
            />

            <TouchableOpacity style={styles.button} onPress={handleNext} disabled={loading || otp.length !== 6}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Next</Text>}
            </TouchableOpacity>
        </View>
    );
}

const PURPLE = '#7B4AE2';
const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
    title: { fontSize: 22, color: PURPLE, fontWeight: '600', marginBottom: 8 },
    subtitle: { color: '#777', marginBottom: 16 },
    input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 16, textAlign: 'center', fontSize: 18, letterSpacing: 6 },
    button: { backgroundColor: PURPLE, borderRadius: 8, alignItems: 'center', paddingVertical: 14 },
    btnText: { color: '#fff', fontWeight: '600' },
});
