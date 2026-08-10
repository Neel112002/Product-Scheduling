import React from 'react';
import {
    View,
    Text,
    Modal,
    Pressable,
    StyleSheet,
    FlatList,
} from 'react-native';

type Props = {
    visible: boolean;
    roles: string[];
    onSelect: (role: string) => void;
    onClose: () => void;
};

export default function RoleSelectorModal({
    visible,
    roles,
    onSelect,
    onClose,
}: Props) {
    return (
        <Modal visible={visible} transparent animationType="fade">
            <Pressable style={styles.backdrop} onPress={onClose}>
                <View style={styles.sheet}>
                    <FlatList
                        data={roles}
                        keyExtractor={(item) => item}
                        renderItem={({ item }) => (
                            <Pressable
                                style={styles.row}
                                onPress={() => onSelect(item)}
                            >
                                <Text>{item}</Text>
                            </Pressable>
                        )}
                    />
                </View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    sheet: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
    },
    row: {
        paddingVertical: 12,
    },
});