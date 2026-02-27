// src/components/home/admin/TeamMemberCard.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../../theme/colors';

type Props = {
    name: string;
    email: string;
};

export default function TeamMemberCard({ name, email }: Props) {
    return (
        <View style={styles.card}>
            <View>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.email}>{email}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    name: {
        fontWeight: '700',
        fontSize: 15,
        color: colors.text,
    },
    email: {
        fontSize: 12,
        color: colors.gray,
        marginTop: 4,
    },
});