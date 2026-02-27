import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export type AlertItem = {
    id: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    subtitle?: string;
    tone?: 'info' | 'warn';
};

type Props = {
    alerts: AlertItem[];
    onItemPress?: (id: string) => void;
};

export default function AlertsCard({ alerts, onItemPress }: Props) {
    return (
        <View style={[styles.card, { marginTop: 12 }]}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Tasks & alerts</Text>
                <Ionicons name="notifications-outline" size={18} color={colors.primary} />
            </View>

            <View style={{ marginTop: 4 }}>
                {alerts.map((a, idx) => (
                    <View
                        key={a.id}
                        style={[
                            styles.alertRow,
                            idx !== alerts.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.inputBorder },
                        ]}
                    >
                        <View
                            style={[
                                styles.alertIconWrap,
                                { backgroundColor: a.tone === 'warn' ? '#FEF3C7' : '#EEF2FF' },
                            ]}
                        >
                            <Ionicons name={a.icon} size={18} color={a.tone === 'warn' ? '#B45309' : colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.alertTitle}>{a.title}</Text>
                            {!!a.subtitle && <Text style={styles.alertSub}>{a.subtitle}</Text>}
                        </View>
                        <Pressable onPress={() => onItemPress?.(a.id)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, padding: 4 }]}>
                            <Ionicons name="chevron-forward" size={20} color={colors.gray} />
                        </Pressable>
                    </View>
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
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },

    alertRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
    alertIconWrap: {
        width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    },
    alertTitle: { color: colors.text, fontWeight: '700' },
    alertSub: { color: colors.gray, fontSize: 12 },
});
