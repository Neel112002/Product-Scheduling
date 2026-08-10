// src/components/PulsingDot.tsx
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

type Props = {
    color: string;
    size?: number;
    // when true, a soft ripple breathes outward — used for "currently working"
    active?: boolean;
};

export default function PulsingDot({ color, size = 12, active = false }: Props) {
    const pulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!active) {
            pulse.setValue(0);
            return;
        }
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0, duration: 1000, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [active]);

    const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
    const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            {active && (
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.ripple,
                        {
                            width: size,
                            height: size,
                            borderRadius: size / 2,
                            backgroundColor: color,
                            opacity,
                            transform: [{ scale }],
                        },
                    ]}
                />
            )}
            <View
                style={[
                    styles.core,
                    { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    ripple: { position: 'absolute' },
    core: { borderWidth: 2, borderColor: '#fff' },
});