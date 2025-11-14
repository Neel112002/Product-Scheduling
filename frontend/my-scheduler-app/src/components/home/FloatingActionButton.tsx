import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

type Props = { onPress?: () => void };

export default function FloatingActionButton({ onPress }: Props) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.fab, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
        >
            <Ionicons name="add" size={26} color={colors.buttonText} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    fab: {
        position: 'absolute', right: 16, bottom: 22,
        width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center',
        elevation: 4, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6,
    },
});
