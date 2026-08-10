import React, { useMemo } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

type Props = {
    name: string;
    initials: string;
    onAvatarPress?: () => void;
    onLogout?: () => void;
};

export default function HeaderGreeting({
    name,
    initials,
    onAvatarPress,
    onLogout,
}: Props) {
    const todayStr = useMemo(() => {
        const d = new Date();
        return d.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
        });
    }, []);

    return (
        <View style={styles.headerRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.nameLine}>
                    <Text style={styles.nameText} numberOfLines={1}>
                        {name}
                    </Text>
                </View>
                <Text style={styles.subtle}>{todayStr}</Text>
            </View>

            {/* Avatar (optional) + Logout (optional) */}
            {(onAvatarPress || onLogout) && (
                <View style={styles.actions}>
                    {onAvatarPress && (
                        <Pressable onPress={onAvatarPress} style={styles.avatar}>
                            <Text style={styles.avatarText}>{initials}</Text>
                        </Pressable>
                    )}

                    {onLogout && (
                        <Pressable
                            onPress={onLogout}
                            style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.7 }]}
                            accessibilityRole="button"
                            accessibilityLabel="Log out"
                        >
                            <Ionicons name="log-out-outline" size={20} color={colors.gray} />
                        </Pressable>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    nameText: { color: colors.text, fontSize: 20, fontWeight: '800', flexShrink: 1 },
    subtle: { color: colors.gray, marginTop: 2 },

    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginLeft: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E9D5FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { color: colors.primary, fontWeight: '800' },

    logoutBtn: {
        padding: 6,
        borderRadius: 999,
    },
});