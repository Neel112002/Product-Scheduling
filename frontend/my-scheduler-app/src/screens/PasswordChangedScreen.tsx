import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';

export default function PasswordChangedScreen({ navigation }: any) {
    return (
        <View style={styles.container}>
            <Image
                source={require('../../assets/check.png')} // add a simple checkmark image
                style={{ width: 100, height: 100, marginBottom: 20 }}
            />
            <Text style={styles.title}>Password Changed!</Text>
            <Text style={styles.subtitle}>You have successfully updated your password.</Text>
            <TouchableOpacity
                style={styles.button}
                onPress={() => navigation.navigate('Login')}
            >
                <Text style={styles.btnText}>Back to Login</Text>
            </TouchableOpacity>
        </View>
    );
}

const PURPLE = '#7B4AE2';
const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' },
    title: { fontSize: 22, color: PURPLE, fontWeight: '600', marginBottom: 8 },
    subtitle: { color: '#777', textAlign: 'center', marginBottom: 24 },
    button: { backgroundColor: PURPLE, borderRadius: 8, alignItems: 'center', paddingVertical: 14, width: '80%' },
    btnText: { color: '#fff', fontWeight: '600' },
});
