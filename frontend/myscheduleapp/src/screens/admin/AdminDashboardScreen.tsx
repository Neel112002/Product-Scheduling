// src/screens/admin/AdminDashboardScreen.tsx

import React, { useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
} from 'react-native';
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
                <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>Admin Dashboard</Text>
                        <Text style={styles.subtitle}>
                            Manage locations, staff and schedules.
                        </Text>
                    </View>

                    <Pressable onPress={handleLogout} style={styles.logoutBtn}>
                        <Ionicons
                            name="log-out-outline"
                            size={18}
                            color={colors.primary}
                        />
                        <Text style={styles.logoutText}>Logout</Text>
                    </Pressable>
                </View>

                <View style={styles.grid}>
                    <AdminTile
                        icon="people-outline"
                        label="Team & Roles"
                        description="Manage staff, permissions and invites."
                        onPress={() => navigation.navigate('TeamRoles')}
                    />

                    <AdminTile
                        icon="business-outline"
                        label="Locations"
                        description="Configure stores and opening hours."
                    />

                    <AdminTile
                        icon="calendar-outline"
                        label="Scheduling"
                        description="Create and publish weekly shifts."
                    />

                    <AdminTile
                        icon="stats-chart-outline"
                        label="Analytics"
                        description="Track hours, labor % and overtime."
                    />
                </View>

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
        <Pressable onPress={onPress} style={styles.tile}>
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

    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },

    logoutText: {
        color: colors.primary,
        fontWeight: '600',
    },

    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },

    tile: {
        width: '47%',
        backgroundColor: colors.background,
        borderRadius: 14,
        padding: 12,
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
        fontWeight: '700',
        fontSize: 14,
    },

    tileDescription: {
        fontSize: 12,
        color: colors.gray,
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
    },
});