// src/components/home/ShiftRing.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../../theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type RingTone = 'neutral' | 'primary' | 'info' | 'warning' | 'danger' | 'success';

const TONE_COLORS: Record<RingTone, string> = {
    neutral: colors.inputBorder,
    primary: colors.primary,
    info: '#6366F1',
    warning: colors.warning,
    danger: colors.error,
    success: colors.success,
};

type Props = {
    // 220 for the full Clock In screen, ~140-160 for the compact Home card
    size?: number;
    strokeWidth?: number;
    // 0 to 1 — how full the ring is
    progress: number;
    tone: RingTone;
    // gentle breathing glow — used for "ready to clock in, waiting for a tap"
    pulsing?: boolean;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    primaryText: string;
    secondaryText?: string;
    actionLabel?: string;
    actionIcon?: React.ComponentProps<typeof Ionicons>['name'];
    onAction?: () => void;
    actionDisabled?: boolean;
};

export default function ShiftRing({
    size = 220,
    strokeWidth = 14,
    progress,
    tone,
    pulsing = false,
    icon,
    label,
    primaryText,
    secondaryText,
    actionLabel,
    actionIcon,
    onAction,
    actionDisabled = false,
}: Props) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progressAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const toneColor = TONE_COLORS[tone];
    const isCompact = size < 200;

    // ── Animate the fill whenever progress changes ─────────────────────────────
    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: Math.max(0, Math.min(1, progress)),
            duration: 900,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false, // strokeDashoffset can't use the native driver
        }).start();
    }, [progress]);

    // ── Breathing glow while waiting for a tap ──────────────────────────────────
    useEffect(() => {
        if (!pulsing) {
            pulseAnim.setValue(0);
            return;
        }
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulsing]);

    const strokeDashoffset = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [circumference, 0],
    });
    const glowOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.14] });
    const glowScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] });

    const handlePress = () => {
        if (actionDisabled || !onAction) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onAction();
    };

    return (
        <View style={styles.wrap}>
            <View style={{ width: size, height: size }}>
                {pulsing && (
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.glow,
                            {
                                backgroundColor: toneColor,
                                opacity: glowOpacity,
                                transform: [{ scale: glowScale }],
                            },
                        ]}
                    />
                )}
                <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={colors.inputBorder}
                        strokeWidth={strokeWidth}
                        fill="none"
                    />
                    <AnimatedCircle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={toneColor}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                    />
                </Svg>
                <View style={styles.center}>
                    <Ionicons name={icon} size={isCompact ? 16 : 22} color={toneColor} />
                    <Text style={[styles.label, { color: toneColor, fontSize: isCompact ? 9 : 11 }]}>
                        {label}
                    </Text>
                    <Text style={[styles.primary, { fontSize: isCompact ? 16 : 26 }]} numberOfLines={1}>
                        {primaryText}
                    </Text>
                    {secondaryText ? (
                        <Text style={[styles.secondary, { fontSize: isCompact ? 10 : 12 }]} numberOfLines={1}>
                            {secondaryText}
                        </Text>
                    ) : null}
                </View>
            </View>

            {actionLabel && (
                <Pressable
                    onPress={handlePress}
                    disabled={actionDisabled}
                    style={({ pressed }) => [
                        styles.actionBtn,
                        { backgroundColor: toneColor },
                        actionDisabled && { opacity: 0.5 },
                        pressed && !actionDisabled && { opacity: 0.85 },
                    ]}
                >
                    {actionIcon && <Ionicons name={actionIcon} size={18} color="#fff" />}
                    <Text style={styles.actionText}>{actionLabel}</Text>
                </Pressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center' },
    glow: {
        position: 'absolute',
        top: 6, left: 6, right: 6, bottom: 6,
        borderRadius: 999,
    },
    center: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: { fontWeight: '600', letterSpacing: 0.3, marginTop: 6 },
    primary: { fontWeight: '500', color: colors.text, marginTop: 2 },
    secondary: { color: colors.gray, marginTop: 2 },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 999,
        width: '100%',
        marginTop: 20,
    },
    actionText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});