import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

type QAItem = {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    onPress?: () => void;
};

type Props = { actions: QAItem[] };

export default function QuickActionsCard({ actions }: Props) {
    return (
        <View style={[styles.card, styles.qaCard]}>
            <Text style={styles.cardTitle}>Quick actions</Text>
            <View style={styles.qaGrid}>
                {actions.map((a) => (
                    <Pressable key={a.label} onPress={a.onPress} style={({ pressed }) => [styles.qaItem, pressed && { opacity: 0.9 }]}>
                        <View style={styles.qaIcon}>
                            <Ionicons name={a.icon} size={18} color={colors.primary} />
                        </View>
                        <Text style={styles.qaLabel} numberOfLines={2}>{a.label}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.background,
        borderRadius: 14,
        padding: 14,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#00000008',
    },
    cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },

    qaCard: { width: 120 },
    qaGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    qaItem: {
        width: '100%',
        backgroundColor: '#FAFAFF',
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        gap: 5,
        borderWidth: 1,
        borderColor: '#EEF2FF',
    },
    qaIcon: {
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center',
    },
    qaLabel: { color: colors.text, fontSize: 12, textAlign: 'center' },
});
