import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { initials as toInitials } from '../../utils/text';

export type TeamMember = {
    id: string;
    name: string;
    status: 'on' | 'break' | 'off';
};

type Props = { members: TeamMember[] };

export default function TeamOnDutyCard({ members }: Props) {
    return (
        <View style={[styles.card, { marginTop: 12 }]}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Team on duty</Text>
                <Ionicons name="people-outline" size={18} color={colors.primary} />
            </View>

            <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={members}
                keyExtractor={(m) => m.id}
                contentContainerStyle={{ paddingVertical: 6 }}
                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                renderItem={({ item }) => (
                    <View style={styles.member}>
                        <View style={styles.memberAvatar}>
                            <Text style={styles.memberText}>{toInitials(item.name)}</Text>
                            <View
                                style={[
                                    styles.badge,
                                    { backgroundColor: item.status === 'on' ? '#22C55E' : item.status === 'break' ? '#F59E0B' : colors.inputBorder },
                                ]}
                            />
                        </View>
                        <Text style={styles.memberName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.memberStatus}>
                            {item.status === 'on' ? 'On shift' : item.status === 'break' ? 'Break' : 'Off'}
                        </Text>
                    </View>
                )}
            />
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

    member: { width: 112, alignItems: 'center' },
    memberAvatar: {
        width: 64, height: 64, borderRadius: 32, backgroundColor: '#F0F9FF',
        alignItems: 'center', justifyContent: 'center', position: 'relative',
    },
    memberText: { color: '#0369A1', fontWeight: '800', fontSize: 16 },
    badge: {
        position: 'absolute', right: -2, bottom: -2, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.background,
    },
    memberName: { color: colors.text, fontWeight: '700', marginTop: 8 },
    memberStatus: { color: colors.gray, fontSize: 12 },
});
