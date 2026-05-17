// src/screens/admin/AIAssistantScreen.tsx
import React, {
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    TextInput,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { AIAPI } from '../../api/api';
import { AuthContext } from '../../context/AuthContext';
import { useQuery } from '@apollo/client/react';
import { MY_LOCATIONS_QUERY } from '../../graphql/operations';

// ── Types ─────────────────────────────────────────────────────────────────────

type MessageRole = 'user' | 'assistant' | 'system';

type ExecutedShift = {
    shift_id: number;
    start_time: string;
    end_time: string;
    role?: string | null;
    status: string;
};

type Message = {
    id: string;
    role: MessageRole;
    content: string;
    timestamp: Date;
    executed_shifts?: ExecutedShift[];
    requires_plan?: 'advanced' | 'professional';
};

type Location = { id: number; name: string };
type MyLocationsData = { myLocations: Location[] };

// ── Quick commands ─────────────────────────────────────────────────────────────

type QuickCommand = {
    label: string;
    prompt: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    requires?: 'advanced' | 'professional';
    color: string;
};

const QUICK_COMMANDS: QuickCommand[] = [
    {
        label: "This week's schedule",
        prompt: "Show me a summary of this week's schedule and any open shifts.",
        icon: 'calendar-outline',
        color: colors.primary,
    },
    {
        label: "Who works tomorrow?",
        prompt: "Who is scheduled to work tomorrow and what are their shift times?",
        icon: 'people-outline',
        color: '#10B981',
    },
    {
        label: "Availability check",
        prompt: "Which staff members are available next week and on which days?",
        icon: 'checkmark-done-outline',
        color: '#F59E0B',
    },
    {
        label: "Generate schedule",
        prompt: "Generate a full schedule for next week based on staff availability.",
        icon: 'sparkles-outline',
        color: colors.primary,
        requires: 'advanced',
    },
    {
        label: "Fill open shifts",
        prompt: "Find and assign staff to all unassigned shifts this week.",
        icon: 'person-add-outline',
        color: '#6366F1',
        requires: 'advanced',
    },
    {
        label: "Predict busy days",
        prompt: "Based on historical data, which days next week will be busiest and how many staff do I need?",
        icon: 'analytics-outline',
        color: '#EF4444',
        requires: 'advanced',
    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-CA', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

function formatMsgTime(date: Date): string {
    return date.toLocaleTimeString('en-CA', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

function uid(): string {
    return Math.random().toString(36).slice(2);
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
    const dot1 = useRef(new Animated.Value(0));
    const dot2 = useRef(new Animated.Value(0));
    const dot3 = useRef(new Animated.Value(0));
    const dots = [dot1.current, dot2.current, dot3.current];

    useEffect(() => {
        const anims = dots.map((dot, i) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(i * 150),
                    Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
                ])
            )
        );
        anims.forEach(a => a.start());
        return () => anims.forEach(a => a.stop());
    }, []);

    return (
        <View style={typingStyles.wrap}>
            <View style={typingStyles.bubble}>
                {dots.map((dot, i) => (
                    <Animated.View
                        key={i}
                        style={[typingStyles.dot, {
                            opacity: dot,
                            transform: [{
                                translateY: dot.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, -4],
                                }),
                            }],
                        }]}
                    />
                ))}
            </View>
        </View>
    );
}

const typingStyles = StyleSheet.create({
    wrap: { alignItems: 'flex-start', marginVertical: 4, marginHorizontal: 16 },
    bubble: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#F3F4F6',
        borderRadius: 18,
        borderBottomLeftRadius: 4,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: colors.gray,
    },
});

// ── Plan badge ────────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: 'advanced' | 'professional' }) {
    return (
        <View style={badgeStyles.wrap}>
            <Ionicons name="lock-closed" size={10} color={colors.primary} />
            <Text style={badgeStyles.text}>
                {plan === 'advanced' ? 'Advanced' : 'Professional'}
            </Text>
        </View>
    );
}

const badgeStyles = StyleSheet.create({
    wrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: colors.primary + '15',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    text: { fontSize: 10, color: colors.primary, fontWeight: '700' },
});

// ── Main component ────────────────────────────────────────────────────────────

export default function AIAssistantScreen({ navigation }: any) {
    const { user } = useContext(AuthContext);
    const flatListRef = useRef<FlatList>(null);

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [selectedLocId, setSelectedLocId] = useState<number | null>(
        user?.primaryLocation?.id ?? null
    );
    const [showCommands, setShowCommands] = useState(true);

    // Company plan
    const companyPlan: string = 'free' // TODO: get from auth context when plan is stored there
    const canWrite = companyPlan === 'advanced' || companyPlan === 'professional';

    // Locations
    const { data: locData } = useQuery<MyLocationsData>(MY_LOCATIONS_QUERY, {
        fetchPolicy: 'cache-and-network',
    });
    const locations = locData?.myLocations ?? [];

    useEffect(() => {
        if (locations.length && !selectedLocId) {
            setSelectedLocId(locations[0]?.id ?? null);
        }
    }, [locations]);

    // Welcome message
    useEffect(() => {
        setMessages([{
            id: uid(),
            role: 'assistant',
            content: `Hi ${user?.display_name || user?.username || 'there'}! 👋\n\nI'm your AI scheduling assistant. I can help you:\n• View and understand your schedule\n• Answer questions about staff availability\n• ${canWrite ? 'Create and assign shifts for you' : 'Suggest schedules (upgrade to Advanced to auto-create shifts)'}\n\nWhat would you like to do?`,
            timestamp: new Date(),
        }]);
    }, []);

    // Build conversation history for API
    const buildHistory = useCallback((msgs: Message[]) => {
        return msgs
            .filter(m => m.role !== 'system')
            .map(m => ({ role: m.role, content: m.content }));
    }, []);

    // Send message
    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || !selectedLocId) return;

        const userMsg: Message = {
            id: uid(),
            role: 'user',
            content: text.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);
        setShowCommands(false);

        // Scroll to bottom
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            const history = buildHistory([...messages, userMsg]);

            const { data } = await AIAPI.chat({
                message: text.trim(),
                location_id: selectedLocId,
                history: history.slice(-10), // last 10 messages for context
            });

            const assistantMsg: Message = {
                id: uid(),
                role: 'assistant',
                content: data.reply,
                timestamp: new Date(),
                executed_shifts: data.executed_shifts?.length > 0
                    ? data.executed_shifts
                    : undefined,
            };

            setMessages(prev => [...prev, assistantMsg]);

        } catch (e: any) {
            const errMsg: Message = {
                id: uid(),
                role: 'assistant',
                content: 'Sorry, I ran into an error. Please try again.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setIsTyping(false);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages, selectedLocId, buildHistory]);

    // Handle quick command
    const handleCommand = (cmd: QuickCommand) => {
        if (cmd.requires && !canWrite) {
            Alert.alert(
                `${cmd.requires === 'advanced' ? 'Advanced' : 'Professional'} Plan Required`,
                `"${cmd.label}" requires the ${cmd.requires} plan. Upgrade to unlock AI-powered scheduling actions.`,
                [
                    { text: 'Maybe later', style: 'cancel' },
                    {
                        text: 'Upgrade',
                        onPress: () => navigation.navigate('AdminDashboard'),
                    },
                ]
            );
            return;
        }
        sendMessage(cmd.prompt);
    };

    // Clear chat
    const handleClear = () => {
        Alert.alert('Clear Chat', 'Start a new conversation?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear',
                onPress: () => {
                    setMessages([{
                        id: uid(),
                        role: 'assistant',
                        content: 'Chat cleared. How can I help you?',
                        timestamp: new Date(),
                    }]);
                    setShowCommands(true);
                },
            },
        ]);
    };

    // Render message
    const renderMessage = ({ item }: { item: Message }) => {
        const isUser = item.role === 'user';

        return (
            <View style={[
                msgStyles.container,
                isUser ? msgStyles.containerUser : msgStyles.containerAI,
            ]}>
                {/* AI avatar */}
                {!isUser && (
                    <View style={msgStyles.aiAvatar}>
                        <Ionicons name="sparkles" size={14} color="#fff" />
                    </View>
                )}

                <View style={[
                    msgStyles.bubble,
                    isUser ? msgStyles.bubbleUser : msgStyles.bubbleAI,
                ]}>
                    <Text style={[
                        msgStyles.text,
                        isUser ? msgStyles.textUser : msgStyles.textAI,
                    ]}>
                        {item.content}
                    </Text>

                    {/* Executed shifts */}
                    {item.executed_shifts && item.executed_shifts.length > 0 && (
                        <View style={msgStyles.shiftsCard}>
                            <View style={msgStyles.shiftsHeader}>
                                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                                <Text style={msgStyles.shiftsTitle}>
                                    {item.executed_shifts.length} shift{item.executed_shifts.length > 1 ? 's' : ''} created
                                </Text>
                            </View>
                            {item.executed_shifts.slice(0, 3).map(shift => (
                                <View key={shift.shift_id} style={msgStyles.shiftRow}>
                                    <Text style={msgStyles.shiftText}>
                                        {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                                        {shift.role ? `  •  ${shift.role}` : ''}
                                    </Text>
                                    <View style={msgStyles.draftBadge}>
                                        <Text style={msgStyles.draftBadgeText}>DRAFT</Text>
                                    </View>
                                </View>
                            ))}
                            {item.executed_shifts.length > 3 && (
                                <Text style={msgStyles.moreShifts}>
                                    +{item.executed_shifts.length - 3} more shifts
                                </Text>
                            )}
                            <Pressable
                                style={msgStyles.viewScheduleBtn}
                                onPress={() => navigation.navigate('Schedule', {})}
                            >
                                <Text style={msgStyles.viewScheduleBtnText}>
                                    View in Schedule →
                                </Text>
                            </Pressable>
                        </View>
                    )}

                    <Text style={[
                        msgStyles.time,
                        isUser ? msgStyles.timeUser : msgStyles.timeAI,
                    ]}>
                        {formatMsgTime(item.timestamp)}
                    </Text>
                </View>
            </View>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>

            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>

                <View style={styles.headerCenter}>
                    <View style={styles.aiDot} />
                    <Text style={styles.headerTitle}>AI Assistant</Text>
                    <View style={[
                        styles.planPill,
                        {
                            backgroundColor: canWrite
                                ? colors.success + '20'
                                : colors.warning + '20'
                        },
                    ]}>
                        <Text style={[
                            styles.planPillText,
                            { color: canWrite ? colors.success : colors.warning },
                        ]}>
                            {canWrite ? 'Advanced' : 'Free'}
                        </Text>
                    </View>
                </View>

                <Pressable onPress={handleClear} style={styles.clearBtn}>
                    <Ionicons name="trash-outline" size={20} color={colors.gray} />
                </Pressable>
            </View>

            {/* Location selector */}
            {locations.length > 1 && (
                <View style={styles.locRow}>
                    {locations.map(loc => (
                        <Pressable
                            key={loc.id}
                            style={[
                                styles.locChip,
                                selectedLocId === loc.id && styles.locChipActive,
                            ]}
                            onPress={() => setSelectedLocId(loc.id)}
                        >
                            <Text style={[
                                styles.locChipText,
                                selectedLocId === loc.id && styles.locChipTextActive,
                            ]}>
                                {loc.name}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            )}

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                {/* Messages */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={item => item.id}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.messageList}
                    onContentSizeChange={() =>
                        flatListRef.current?.scrollToEnd({ animated: true })
                    }
                    ListFooterComponent={isTyping ? <TypingIndicator /> : null}
                />

                {/* Quick commands */}
                {showCommands && (
                    <View style={styles.commandsSection}>
                        <Text style={styles.commandsLabel}>Quick actions</Text>
                        <View style={styles.commandsGrid}>
                            {QUICK_COMMANDS.map(cmd => {
                                const locked = !!cmd.requires && !canWrite;
                                return (
                                    <Pressable
                                        key={cmd.label}
                                        style={[
                                            styles.commandBtn,
                                            locked && styles.commandBtnLocked,
                                        ]}
                                        onPress={() => handleCommand(cmd)}
                                    >
                                        <View style={[
                                            styles.commandIconWrap,
                                            { backgroundColor: cmd.color + '18' },
                                            locked && { backgroundColor: '#F3F4F6' },
                                        ]}>
                                            <Ionicons
                                                name={locked ? 'lock-closed-outline' : cmd.icon}
                                                size={18}
                                                color={locked ? colors.gray : cmd.color}
                                            />
                                        </View>
                                        <Text style={[
                                            styles.commandLabel,
                                            locked && { color: colors.gray },
                                        ]} numberOfLines={2}>
                                            {cmd.label}
                                        </Text>
                                        {cmd.requires && (
                                            <PlanBadge plan={cmd.requires} />
                                        )}
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Input bar */}
                <View style={styles.inputBar}>
                    {!showCommands && (
                        <Pressable
                            style={styles.commandsToggle}
                            onPress={() => setShowCommands(true)}
                        >
                            <Ionicons name="apps-outline" size={22} color={colors.gray} />
                        </Pressable>
                    )}

                    <TextInput
                        style={styles.input}
                        value={input}
                        onChangeText={setInput}
                        placeholder="Ask me anything about your schedule..."
                        placeholderTextColor={colors.gray}
                        multiline
                        maxLength={500}
                        returnKeyType="send"
                        onSubmitEditing={() => sendMessage(input)}
                    />

                    <Pressable
                        style={[
                            styles.sendBtn,
                            (!input.trim() || isTyping) && styles.sendBtnDisabled,
                        ]}
                        onPress={() => sendMessage(input)}
                        disabled={!input.trim() || isTyping}
                    >
                        {isTyping ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="send" size={18} color="#fff" />
                        )}
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// ── Message styles ────────────────────────────────────────────────────────────

const msgStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        marginVertical: 4,
        marginHorizontal: 16,
        gap: 8,
    },
    containerUser: { justifyContent: 'flex-end' },
    containerAI: { justifyContent: 'flex-start' },

    aiAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
        flexShrink: 0,
    },

    bubble: {
        maxWidth: '78%',
        borderRadius: 18,
        padding: 12,
    },
    bubbleUser: {
        backgroundColor: colors.primary,
        borderBottomRightRadius: 4,
    },
    bubbleAI: {
        backgroundColor: '#F3F4F6',
        borderBottomLeftRadius: 4,
    },

    text: { fontSize: 14, lineHeight: 20 },
    textUser: { color: '#fff' },
    textAI: { color: colors.text },

    time: { fontSize: 10, marginTop: 4 },
    timeUser: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
    timeAI: { color: colors.gray },

    // Executed shifts card
    shiftsCard: {
        marginTop: 10,
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: colors.success + '30',
        gap: 6,
    },
    shiftsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    shiftsTitle: { fontSize: 12, fontWeight: '700', color: colors.success },
    shiftRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    shiftText: { fontSize: 12, color: colors.text, flex: 1 },
    draftBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: colors.warning + '20',
    },
    draftBadgeText: { fontSize: 9, color: colors.warning, fontWeight: '800' },
    moreShifts: { fontSize: 11, color: colors.gray, fontStyle: 'italic' },
    viewScheduleBtn: { marginTop: 4 },
    viewScheduleBtnText: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '700',
    },
});

// ── Screen styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8F8FC' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        gap: 8,
    },
    backBtn: { padding: 4 },
    headerCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    aiDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.success,
        shadowColor: colors.success,
        shadowOpacity: 0.6,
        shadowRadius: 4,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    planPill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
    },
    planPillText: { fontSize: 11, fontWeight: '700' },
    clearBtn: { padding: 4 },

    // Location row
    locRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    locChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        backgroundColor: '#FAFAFA',
    },
    locChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    locChipText: { fontSize: 13, color: colors.text, fontWeight: '600' },
    locChipTextActive: { color: '#fff' },

    // Messages
    messageList: { paddingVertical: 16, paddingBottom: 8 },

    // Quick commands
    commandsSection: {
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    commandsLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.gray,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
    },
    commandsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    commandBtn: {
        width: '30%',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: '#EFEFEF',
        alignItems: 'flex-start',
        gap: 6,
        minHeight: 90,
    },
    commandBtnLocked: {
        backgroundColor: '#FAFAFA',
        borderColor: '#EFEFEF',
    },
    commandIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    commandLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.text,
        lineHeight: 15,
    },

    // Input bar
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        paddingBottom: Platform.OS === 'ios' ? 24 : 10,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    commandsToggle: { padding: 4, paddingBottom: 8 },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 14,
        color: colors.text,
        backgroundColor: '#FAFAFA',
        maxHeight: 100,
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 3,
    },
    sendBtnDisabled: {
        backgroundColor: colors.inputBorder,
        shadowOpacity: 0,
        elevation: 0,
    },
});