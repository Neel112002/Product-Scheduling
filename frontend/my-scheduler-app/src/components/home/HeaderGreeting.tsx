import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    Modal,
    FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

type Props = {
    name: string;
    initials: string;
    onAvatarPress?: () => void;

    // Location props (controlled)
    locations: string[];
    selectedLocation: string;
    onChangeLocation: (loc: string) => void;

    // 🔥 NEW: logout handler
    onLogout?: () => void;
};

export default function HeaderGreeting({
    name,
    initials,
    onAvatarPress,
    locations,
    selectedLocation,
    onChangeLocation,
    onLogout,
}: Props) {
    const [open, setOpen] = useState(false);

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

                {/* Location dropdown */}
                <Pressable
                    onPress={() => setOpen(true)}
                    style={({ pressed }) => [styles.locBtn, pressed && { opacity: 0.9 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Change location"
                >
                    <Ionicons name="location-outline" size={16} color={colors.primary} />
                    <Text style={styles.locText} numberOfLines={1}>
                        {selectedLocation}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={colors.gray} />
                </Pressable>
            </View>

            {/* Avatar + Logout */}
            <View style={styles.actions}>
                <Pressable onPress={onAvatarPress} style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials}</Text>
                </Pressable>

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

            {/* Dropdown Modal */}
            <Modal
                visible={open}
                transparent
                animationType="fade"
                onRequestClose={() => setOpen(false)}
            >
                <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
                    <View />
                </Pressable>

                <View style={styles.sheet}>
                    <View style={styles.sheetHeader}>
                        <Text style={styles.sheetTitle}>Select location</Text>
                        <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                            <Ionicons name="close" size={20} color={colors.gray} />
                        </Pressable>
                    </View>

                    <FlatList
                        data={locations}
                        keyExtractor={(item) => item}
                        ItemSeparatorComponent={() => <View style={styles.sep} />}
                        renderItem={({ item }) => {
                            const active = item === selectedLocation;
                            return (
                                <Pressable
                                    onPress={() => {
                                        onChangeLocation(item);
                                        setOpen(false);
                                    }}
                                    style={({ pressed }) => [
                                        styles.row,
                                        pressed && { backgroundColor: '#F7F7F7' },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.rowText,
                                            active && { color: colors.primary, fontWeight: '700' },
                                        ]}
                                    >
                                        {item}
                                    </Text>
                                    {active && (
                                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                                    )}
                                </Pressable>
                            );
                        }}
                    />
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    nameText: { color: colors.text, fontSize: 20, fontWeight: '800', flexShrink: 1 },
    subtle: { color: colors.gray, marginTop: 2 },

    locBtn: {
        marginTop: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    locText: { color: colors.text, fontSize: 13, maxWidth: 220 },

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

    // modal + sheet
    backdrop: {
        position: 'absolute',
        inset: 0 as any,
        backgroundColor: 'rgba(0,0,0,0.15)',
    },
    sheet: {
        position: 'absolute',
        left: 16,
        right: 16,
        top: 110,
        borderRadius: 14,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: '#00000010',
        padding: 10,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    sheetHeader: {
        paddingHorizontal: 4,
        paddingVertical: 6,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sheetTitle: { color: colors.text, fontWeight: '700' },
    sep: { height: 1, backgroundColor: colors.inputBorder, opacity: 0.7 },

    row: {
        paddingVertical: 10,
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rowText: { color: colors.text, fontSize: 14 },
});
