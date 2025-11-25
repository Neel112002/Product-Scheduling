// src/screens/admin/AdminDashboardScreen.tsx
import React, { useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { AuthContext } from '../../context/AuthContext';

export default function AdminDashboardScreen({ navigation }: any) {
    const { logout } = useContext(AuthContext);

    const handleLogout = async () => {
        try {
            await logout();
        } catch (e) {
            console.warn('Logout failed', e);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
            >
                {/* Header */}
                <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>Admin dashboard</Text>
                        <Text style={styles.subtitle}>
                            Manage locations, staff and schedules.
                        </Text>
                    </View>

                    {/* 🔐 Logout button */}
                    <Pressable
                        onPress={handleLogout}
                        style={({ pressed }) => [
                            styles.logoutBtn,
                            pressed && { opacity: 0.8 },
                        ]}
                    >
                        <Ionicons
                            name="log-out-outline"
                            size={18}
                            color={colors.primary}
                            style={{ marginRight: 4 }}
                        />
                        <Text style={styles.logoutText}>Logout</Text>
                    </Pressable>
                </View>

                {/* Quick admin tiles */}
                <View style={styles.grid}>
                    <AdminTile
                        icon="people-outline"
                        label="Team & roles"
                        description="Manage staff, permissions and invites."
                        onPress={() => {}}
                    />
                    <AdminTile
                        icon="business-outline"
                        label="Locations"
                        description="Configure stores and opening hours."
                        onPress={() => {}}
                    />
                    <AdminTile
                        icon="calendar-outline"
                        label="Scheduling"
                        description="Create and publish weekly shifts."
                        onPress={() => {}}
                    />
                    <AdminTile
                        icon="stats-chart-outline"
                        label="Analytics"
                        description="Track hours, labor % and overtime."
                        onPress={() => {}}
                    />
                </View>

                {/* Placeholder section */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Coming next</Text>
                    <Text style={styles.cardBody}>
                        This is a placeholder admin dashboard. You can later plug in:
                        {'\n'}• Shift templates & auto-scheduling
                        {'\n'}• Staff onboarding forms
                        {'\n'}• Labor cost & utilization charts
                        {'\n'}• Notifications and approvals
                    </Text>
                </View>

                {/* Invite Staff Button */}
                <Pressable
                    style={styles.inviteButton}
                    onPress={() => navigation.navigate('InviteStaff')}
                >
                    <Ionicons
                        name="person-add-outline"
                        size={18}
                        color={colors.buttonText}
                        style={{ marginRight: 8 }}
                    />
                    <Text style={styles.inviteButtonText}>Invite Staff Member</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

function AdminTile({
    icon,
    label,
    description,
    onPress,
}: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    description: string;
    onPress?: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.tile,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
        >
            <View style={styles.tileIconWrap}>
                <Ionicons name={icon} size={20} color={colors.primary} />
            </View>
            <Text style={styles.tileLabel}>{label}</Text>
            <Text style={styles.tileDescription}>{description}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F6F7FB' },
    container: { flex: 1 },
    headerRow: {
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: colors.text,
    },
    subtitle: {
        fontSize: 13,
        color: colors.gray,
        marginTop: 4,
    },

    // 🔐 Logout styles
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        backgroundColor: '#FFFFFF',
        marginLeft: 8,
    },
    logoutText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: '600',
    },

    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
    },
    tile: {
        width: '47%',
        backgroundColor: colors.background,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#00000010',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    tileIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    tileLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.text,
    },
    tileDescription: {
        fontSize: 12,
        color: colors.gray,
        marginTop: 4,
    },
    card: {
        backgroundColor: colors.background,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#00000010',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 6,
    },
    cardBody: {
        fontSize: 13,
        color: colors.gray,
        lineHeight: 18,
    },

    inviteButton: {
        marginTop: 20,
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 999,
    },
    inviteButtonText: {
        color: colors.buttonText,
        fontWeight: '700',
        fontSize: 15,
    },
});
