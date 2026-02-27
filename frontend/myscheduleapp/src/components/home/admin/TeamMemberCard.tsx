import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';

type Props = {
    name: string;
    email: string;
    role: string;
    onChangeRole: () => void;
};

export default function TeamMemberCard({
    name,
    email,
    role,
    onChangeRole,
}: Props) {
    return (
        <View style={styles.card}>
            <View>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.email}>{email}</Text>
            </View>

            <Pressable style={styles.roleButton} onPress={onChangeRole}>
                <Text style={styles.roleText}>{role}</Text>
                <Ionicons name="chevron-down" size={16} color="#fff" />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    name: {
        fontWeight: '700',
        fontSize: 15,
    },
    email: {
        fontSize: 12,
        color: '#666',
    },
    roleButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    roleText: {
        color: '#fff',
        fontWeight: '600',
    },
});