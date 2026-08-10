// src/screens/ChatScreen.tsx
import React, {
    useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import {
    View, Text, StyleSheet, FlatList, Pressable,
    TextInput, Alert, ActivityIndicator, Modal, ScrollView,
    KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { colors }       from '../theme/colors';
import { MessagingAPI } from '../api/api';
import { AuthContext }  from '../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type Reaction = { emoji: string; count: number; mine: boolean };

type ReplyPreview = {
    message_id:  number;
    content:     string;
    sender_name: string;
};

type MessageData = {
    message_id:      number;
    channel_id:      number;
    content:         string;
    is_deleted:      boolean;
    is_pinned:       boolean;
    sender_id:       number | null;
    sender_name:     string;
    sender_initials: string;
    is_mine:         boolean;
    reply_to?:       ReplyPreview | null;
    reactions:       Reaction[];
    read_count:      number;
    created_at:      string;
};

type Member = {
    user_id:  number;
    name:     string;
    initials: string;
    is_admin: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-CA', {
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
}

function fmtDate(iso: string) {
    const d    = new Date(iso);
    const now  = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function getDateKey(iso: string) {
    return new Date(iso).toDateString();
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '🎉', '✅'];

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ initials, color = colors.primary }: { initials: string; color?: string }) {
    return (
        <View style={[av.wrap, { backgroundColor: color + '25' }]}>
            <Text style={[av.text, { color }]}>{initials}</Text>
        </View>
    );
}
const av = StyleSheet.create({
    wrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    text: { fontSize: 12, fontWeight: '700' },
});

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
    msg, isManager, onLongPress, onReact,
}: {
    msg:       MessageData;
    isManager: boolean;
    onLongPress: (msg: MessageData) => void;
    onReact:   (msg: MessageData, emoji: string) => void;
}) {
    const isSystem = msg.sender_id === null;
    const isMe     = msg.is_mine;

    if (isSystem) {
        return (
            <View style={mb.systemRow}>
                <Text style={mb.systemText}>{msg.content}</Text>
            </View>
        );
    }

    return (
        <Pressable
            style={[mb.row, isMe ? mb.rowMe : mb.rowOther]}
            onLongPress={() => onLongPress(msg)}
            delayLongPress={400}
        >
            {!isMe && <Avatar initials={msg.sender_initials} />}

            <View style={[mb.col, isMe ? mb.colMe : mb.colOther]}>
                {!isMe && (
                    <Text style={mb.senderName}>{msg.sender_name}</Text>
                )}

                {/* Reply preview */}
                {msg.reply_to && (
                    <View style={[mb.replyPreview, isMe ? mb.replyPreviewMe : mb.replyPreviewOther]}>
                        <Text style={mb.replyPreviewSender}>{msg.reply_to.sender_name}</Text>
                        <Text style={mb.replyPreviewContent} numberOfLines={1}>
                            {msg.reply_to.content}
                        </Text>
                    </View>
                )}

                {/* Bubble */}
                <View style={[mb.bubble, isMe ? mb.bubbleMe : mb.bubbleOther]}>
                    {msg.is_deleted ? (
                        <Text style={[mb.content, mb.contentDeleted]}>🚫 Message deleted</Text>
                    ) : (
                        <Text style={[mb.content, isMe ? mb.contentMe : mb.contentOther]}>
                            {msg.content}
                        </Text>
                    )}
                </View>

                {/* Reactions */}
                {msg.reactions.length > 0 && (
                    <View style={[mb.reactions, isMe ? mb.reactionsMe : mb.reactionsOther]}>
                        {msg.reactions.map(r => (
                            <Pressable
                                key={r.emoji}
                                style={[mb.reactionPill, r.mine && mb.reactionPillMine]}
                                onPress={() => onReact(msg, r.emoji)}
                            >
                                <Text style={mb.reactionEmoji}>{r.emoji}</Text>
                                <Text style={[mb.reactionCount, r.mine && mb.reactionCountMine]}>
                                    {r.count}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                )}

                {/* Time + read count */}
                <View style={[mb.meta, isMe ? mb.metaMe : mb.metaOther]}>
                    <Text style={mb.time}>{fmtTime(msg.created_at)}</Text>
                    {isMe && msg.is_pinned && (
                        <Ionicons name="pin" size={11} color={colors.warning} />
                    )}
                    {isManager && msg.read_count > 0 && (
                        <Text style={mb.readCount}>✓ {msg.read_count}</Text>
                    )}
                </View>
            </View>

            {isMe && <View style={{ width: 32 }} />}
        </Pressable>
    );
}

const mb = StyleSheet.create({
    row:        { flexDirection: 'row', marginVertical: 2, paddingHorizontal: 12, gap: 8, alignItems: 'flex-end' },
    rowMe:      { justifyContent: 'flex-end' },
    rowOther:   { justifyContent: 'flex-start' },
    col:        { maxWidth: '72%' },
    colMe:      { alignItems: 'flex-end' },
    colOther:   { alignItems: 'flex-start' },
    senderName: { fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 2, marginLeft: 4 },

    replyPreview:       { borderRadius: 8, padding: 6, marginBottom: 3, borderLeftWidth: 3 },
    replyPreviewMe:     { backgroundColor: '#ffffff30', borderLeftColor: '#ffffff80' },
    replyPreviewOther:  { backgroundColor: '#0000000A', borderLeftColor: colors.primary },
    replyPreviewSender: { fontSize: 10, fontWeight: '700', color: colors.primary },
    replyPreviewContent:{ fontSize: 11, color: colors.gray },

    bubble:       { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, maxWidth: '100%' },
    bubbleMe:     { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
    bubbleOther:  { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#EFEFEF' },

    content:        { fontSize: 14, lineHeight: 20 },
    contentMe:      { color: '#fff' },
    contentOther:   { color: colors.text },
    contentDeleted: { fontStyle: 'italic', color: colors.gray },

    reactions:      { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
    reactionsMe:    { justifyContent: 'flex-end' },
    reactionsOther: { justifyContent: 'flex-start' },
    reactionPill: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: '#F3F4F6', borderRadius: 999,
        paddingHorizontal: 7, paddingVertical: 3,
        borderWidth: 1, borderColor: '#E5E7EB',
    },
    reactionPillMine:  { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' },
    reactionEmoji:     { fontSize: 13 },
    reactionCount:     { fontSize: 11, fontWeight: '600', color: colors.gray },
    reactionCountMine: { color: colors.primary },

    meta:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, paddingHorizontal: 4 },
    metaMe:   { justifyContent: 'flex-end' },
    metaOther:{ justifyContent: 'flex-start' },
    time:     { fontSize: 10, color: colors.gray },
    readCount:{ fontSize: 10, color: colors.primary, fontWeight: '600' },

    systemRow:  { alignItems: 'center', paddingVertical: 4 },
    systemText: { fontSize: 11, color: colors.gray, fontStyle: 'italic', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
});

// ── Main component ────────────────────────────────────────────────────────────

export default function ChatScreen({ route, navigation }: any) {
    const { channelId, channelName, channelType } = route.params;
    const { user: authUser } = useContext(AuthContext);

    const [messages,       setMessages]       = useState<MessageData[]>([]);
    const [loading,        setLoading]        = useState(true);
    const [hasMore,        setHasMore]        = useState(false);
    const [loadingMore,    setLoadingMore]    = useState(false);
    const [text,           setText]           = useState('');
    const [sending,        setSending]        = useState(false);
    const [replyTo,        setReplyTo]        = useState<MessageData | null>(null);
    const [pinnedCount,    setPinnedCount]    = useState(0);
    const [showPinned,     setShowPinned]     = useState(false);
    const [pinnedMessages, setPinnedMessages] = useState<MessageData[]>([]);
    const [showMembers,    setShowMembers]    = useState(false);
    const [members,        setMembers]        = useState<Member[]>([]);
    const [actionMsg,      setActionMsg]      = useState<MessageData | null>(null);
    const [showActions,    setShowActions]    = useState(false);
    const [mentionQuery,   setMentionQuery]   = useState('');

    const flatListRef = useRef<FlatList>(null);
    const pollRef      = useRef<any>(null);
    const lastMsgId    = useRef<number>(0);

    const isManager = ['owner', 'manager'].includes(
        authUser?.role?.name?.toLowerCase() ?? ''
    );

    // ── Fetch messages ────────────────────────────────────────────────────────
    const fetchMessages = useCallback(async (append = false) => {
        try {
            const beforeId = append && messages.length > 0 ? messages[0].message_id : undefined;
            const { data } = await MessagingAPI.getMessages(channelId, beforeId);
            const msgs: MessageData[] = data?.messages ?? [];

            if (append) {
                setMessages(prev => [...msgs, ...prev]);
            } else {
                setMessages(msgs);
                if (msgs.length > 0) lastMsgId.current = msgs[msgs.length - 1].message_id;
            }
            setHasMore(data?.has_more ?? false);
        } catch {
            if (!append) Alert.alert('Error', 'Could not load messages.');
        } finally {
            setLoading(false);
        }
    }, [channelId]);

    useEffect(() => {
        fetchMessages();
        MessagingAPI.markRead(channelId).catch(() => {});

        MessagingAPI.getPinned(channelId).then(({ data }) => {
            setPinnedCount((data?.messages ?? []).length);
        }).catch(() => {});

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [channelId]);

    // Poll for new messages every 4 seconds
    useEffect(() => {
        pollRef.current = setInterval(async () => {
            try {
                const { data } = await MessagingAPI.getMessages(channelId);
                const msgs: MessageData[] = data?.messages ?? [];
                if (msgs.length > 0) {
                    const newLatest = msgs[msgs.length - 1].message_id;
                    if (newLatest > lastMsgId.current) {
                        setMessages(msgs);
                        lastMsgId.current = newLatest;
                        MessagingAPI.markRead(channelId).catch(() => {});
                    }
                }
            } catch {}
        }, 4000);
        return () => clearInterval(pollRef.current);
    }, [channelId]);

    // Fetch members
    const fetchMembers = useCallback(async () => {
        try {
            const { data } = await MessagingAPI.getMembers(channelId);
            setMembers(data?.members ?? []);
        } catch {}
    }, [channelId]);

    useEffect(() => { fetchMembers(); }, [fetchMembers]);

    // ── Send message ──────────────────────────────────────────────────────────
    const handleSend = async () => {
        const content = text.trim();
        if (!content || sending) return;

        setSending(true);
        try {
            await MessagingAPI.sendMessage(channelId, content, replyTo?.message_id);
            setText('');
            setReplyTo(null);
            setMentionQuery('');
            await fetchMessages();
            flatListRef.current?.scrollToEnd({ animated: true });
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to send.');
        } finally {
            setSending(false);
        }
    };

    // ── @mention detection ────────────────────────────────────────────────────
    const handleTextChange = (val: string) => {
        setText(val);
        const words    = val.split(' ');
        const lastWord = words[words.length - 1];
        if (lastWord.startsWith('@') && lastWord.length > 1) {
            setMentionQuery(lastWord.slice(1).toLowerCase());
        } else {
            setMentionQuery('');
        }
    };

    const filteredMentions = mentionQuery
        ? members.filter(m => m.name?.toLowerCase().includes(mentionQuery))
        : [];

    const insertMention = (member: Member) => {
        const words = text.split(' ');
        words[words.length - 1] = `@${member.name?.split(' ')[0]} `;
        setText(words.join(' '));
        setMentionQuery('');
    };

    // ── Long press action menu ────────────────────────────────────────────────
    const handleLongPress = (msg: MessageData) => {
        setActionMsg(msg);
        setShowActions(true);
    };

    const handleAction = async (action: string) => {
        if (!actionMsg) return;
        setShowActions(false);

        switch (action) {
            case 'reply':
                setReplyTo(actionMsg);
                break;
            case 'pin':
                try {
                    await MessagingAPI.pinMessage(actionMsg.message_id);
                    await fetchMessages();
                    const { data } = await MessagingAPI.getPinned(channelId);
                    setPinnedCount((data?.messages ?? []).length);
                } catch (e: any) {
                    Alert.alert('Error', e?.response?.data?.error ?? 'Failed to pin.');
                }
                break;
        }
        setActionMsg(null);
    };

    const handleReact = async (msg: MessageData, emoji: string) => {
        setShowActions(false);
        setActionMsg(null);
        try {
            await MessagingAPI.reactToMessage(msg.message_id, emoji);
            await fetchMessages();
        } catch {}
    };

    // ── Pinned messages ───────────────────────────────────────────────────────
    const openPinned = async () => {
        try {
            const { data } = await MessagingAPI.getPinned(channelId);
            setPinnedMessages(data?.messages ?? []);
            setShowPinned(true);
        } catch {}
    };

    // ── Date separators ───────────────────────────────────────────────────────
    const messagesWithDates: (MessageData | { type: 'date'; key: string; label: string })[] = [];
    let lastDate = '';
    for (const msg of messages) {
        const dk = getDateKey(msg.created_at);
        if (dk !== lastDate) {
            messagesWithDates.push({ type: 'date', key: dk, label: fmtDate(msg.created_at) });
            lastDate = dk;
        }
        messagesWithDates.push(msg);
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Pressable style={styles.headerCenter} onPress={() => setShowMembers(true)}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{channelName}</Text>
                    <Text style={styles.headerSub}>{members.length} members</Text>
                </Pressable>
                {pinnedCount > 0 && (
                    <Pressable style={styles.pinBtn} onPress={openPinned}>
                        <Ionicons name="pin" size={16} color={colors.warning} />
                        <Text style={styles.pinBtnText}>{pinnedCount}</Text>
                    </Pressable>
                )}
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={90}
                >
                    {/* Load more */}
                    {hasMore && (
                        <Pressable style={styles.loadMoreBtn} onPress={() => {
                            setLoadingMore(true);
                            fetchMessages(true).finally(() => setLoadingMore(false));
                        }}>
                            {loadingMore
                                ? <ActivityIndicator size="small" color={colors.primary} />
                                : <Text style={styles.loadMoreText}>Load earlier messages</Text>
                            }
                        </Pressable>
                    )}

                    {/* Messages */}
                    <FlatList
                        ref={flatListRef}
                        data={messagesWithDates}
                        keyExtractor={(item: any) => item.message_id?.toString() ?? item.key}
                        renderItem={({ item }: any) => {
                            if (item.type === 'date') {
                                return (
                                    <View style={styles.dateSep}>
                                        <View style={styles.dateLine} />
                                        <Text style={styles.dateLabel}>{item.label}</Text>
                                        <View style={styles.dateLine} />
                                    </View>
                                );
                            }
                            return (
                                <MessageBubble
                                    msg={item}
                                    isManager={isManager}
                                    onLongPress={handleLongPress}
                                    onReact={handleReact}
                                />
                            );
                        }}
                        contentContainerStyle={styles.messageList}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                        showsVerticalScrollIndicator={false}
                    />

                    {/* @Mention suggestions */}
                    {filteredMentions.length > 0 && (
                        <View style={styles.mentionBox}>
                            {filteredMentions.slice(0, 4).map(m => (
                                <Pressable
                                    key={m.user_id}
                                    style={styles.mentionRow}
                                    onPress={() => insertMention(m)}
                                >
                                    <Avatar initials={m.initials} />
                                    <Text style={styles.mentionName}>{m.name}</Text>
                                    {m.is_admin && (
                                        <View style={styles.adminPill}>
                                            <Text style={styles.adminPillText}>Admin</Text>
                                        </View>
                                    )}
                                </Pressable>
                            ))}
                        </View>
                    )}

                    {/* Reply preview bar */}
                    {replyTo && (
                        <View style={styles.replyBar}>
                            <View style={styles.replyBarContent}>
                                <Ionicons name="return-up-forward" size={14} color={colors.primary} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.replyBarSender}>{replyTo.sender_name}</Text>
                                    <Text style={styles.replyBarText} numberOfLines={1}>{replyTo.content}</Text>
                                </View>
                            </View>
                            <Pressable onPress={() => setReplyTo(null)} style={styles.replyBarClose}>
                                <Ionicons name="close" size={18} color={colors.gray} />
                            </Pressable>
                        </View>
                    )}

                    {/* Input bar */}
                    <View style={styles.inputBar}>
                        <TextInput
                            style={styles.input}
                            value={text}
                            onChangeText={handleTextChange}
                            placeholder={
                                channelType === 'broadcast' && !isManager
                                    ? 'Read-only channel'
                                    : 'Message...'
                            }
                            placeholderTextColor={colors.gray}
                            multiline
                            maxLength={1000}
                            editable={channelType !== 'broadcast' || isManager}
                        />
                        <Pressable
                            style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}
                            onPress={handleSend}
                            disabled={!text.trim() || sending}
                        >
                            {sending
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Ionicons name="send" size={18} color="#fff" />
                            }
                        </Pressable>
                    </View>
                </KeyboardAvoidingView>
            )}

            {/* Message action / emoji picker modal */}
            <Modal
                visible={showActions}
                transparent
                animationType="slide"
                onRequestClose={() => setShowActions(false)}
            >
                <Pressable style={styles.overlay} onPress={() => setShowActions(false)}>
                    <Pressable style={styles.actionSheet} onPress={e => e.stopPropagation()}>
                        <View style={styles.sheetHandle} />

                        {/* Quick reactions */}
                        <View style={styles.emojiRow}>
                            {QUICK_EMOJIS.map(emoji => (
                                <Pressable
                                    key={emoji}
                                    style={styles.emojiBtn}
                                    onPress={() => actionMsg && handleReact(actionMsg, emoji)}
                                >
                                    <Text style={styles.emojiText}>{emoji}</Text>
                                </Pressable>
                            ))}
                        </View>

                        {/* Actions */}
                        {[
                            { key: 'reply', icon: 'return-up-forward-outline', label: 'Reply' },
                            ...(isManager ? [{ key: 'pin', icon: 'pin-outline', label: actionMsg?.is_pinned ? 'Unpin' : 'Pin message' }] : []),
                        ].map(action => (
                            <Pressable
                                key={action.key}
                                style={styles.actionRow}
                                onPress={() => handleAction(action.key)}
                            >
                                <Ionicons name={action.icon as any} size={20} color={colors.text} />
                                <Text style={styles.actionLabel}>{action.label}</Text>
                            </Pressable>
                        ))}

                        <Pressable
                            style={[styles.actionRow, { marginTop: 4 }]}
                            onPress={() => { setShowActions(false); setActionMsg(null); }}
                        >
                            <Ionicons name="close-outline" size={20} color={colors.error} />
                            <Text style={[styles.actionLabel, { color: colors.error }]}>Cancel</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Pinned messages modal */}
            <Modal visible={showPinned} transparent animationType="slide" onRequestClose={() => setShowPinned(false)}>
                <Pressable style={styles.overlay} onPress={() => setShowPinned(false)}>
                    <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>📌 Pinned Messages</Text>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {pinnedMessages.map(msg => (
                                <View key={msg.message_id} style={styles.pinnedMsg}>
                                    <View style={styles.pinnedMsgHeader}>
                                        <Avatar initials={msg.sender_initials} />
                                        <Text style={styles.pinnedMsgSender}>{msg.sender_name}</Text>
                                        <Text style={styles.pinnedMsgTime}>{fmtTime(msg.created_at)}</Text>
                                    </View>
                                    <Text style={styles.pinnedMsgContent}>{msg.content}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Members modal */}
            <Modal visible={showMembers} transparent animationType="slide" onRequestClose={() => setShowMembers(false)}>
                <Pressable style={styles.overlay} onPress={() => setShowMembers(false)}>
                    <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>{channelName}</Text>
                        <Text style={styles.sheetSub}>{members.length} members</Text>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {members.map(m => (
                                <View key={m.user_id} style={styles.memberListRow}>
                                    <Avatar initials={m.initials} />
                                    <Text style={styles.memberListName}>{m.name}</Text>
                                    {m.is_admin && (
                                        <View style={styles.adminPill}>
                                            <Text style={styles.adminPillText}>Admin</Text>
                                        </View>
                                    )}
                                </View>
                            ))}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe:             { flex: 1, backgroundColor: '#F0F0F5' },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 8,
    },
    backBtn:      { padding: 4 },
    headerCenter: { flex: 1 },
    headerTitle:  { fontSize: 15, fontWeight: '700', color: colors.text },
    headerSub:    { fontSize: 11, color: colors.gray, marginTop: 1 },
    pinBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 5,
        backgroundColor: colors.warning + '15', borderRadius: 999,
    },
    pinBtnText: { fontSize: 11, fontWeight: '700', color: colors.warning },

    loadMoreBtn: {
        alignItems: 'center', paddingVertical: 10,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EFEFEF',
    },
    loadMoreText: { fontSize: 13, color: colors.primary, fontWeight: '600' },

    messageList: { paddingVertical: 8, paddingBottom: 4 },

    dateSep:   { flexDirection: 'row', alignItems: 'center', marginVertical: 10, paddingHorizontal: 16 },
    dateLine:  { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
    dateLabel: { fontSize: 11, color: colors.gray, fontWeight: '600', marginHorizontal: 10 },

    mentionBox: {
        backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#EFEFEF',
        maxHeight: 180,
    },
    mentionRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
    },
    mentionName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },

    replyBar: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#EFEFEF',
        paddingHorizontal: 16, paddingVertical: 8, gap: 8,
    },
    replyBarContent: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: colors.primary + '10', borderRadius: 8,
        paddingHorizontal: 10, paddingVertical: 6, borderLeftWidth: 3, borderLeftColor: colors.primary,
    },
    replyBarSender:  { fontSize: 11, fontWeight: '700', color: colors.primary },
    replyBarText:    { fontSize: 12, color: colors.gray },
    replyBarClose:   { padding: 4 },

    inputBar: {
        flexDirection: 'row', alignItems: 'flex-end', gap: 8,
        backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10,
        borderTopWidth: 1, borderTopColor: '#EFEFEF',
    },
    input: {
        flex: 1, borderWidth: 1.5, borderColor: colors.inputBorder,
        borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
        fontSize: 14, color: colors.text, maxHeight: 120,
        backgroundColor: '#FAFAFA',
    },
    sendBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center',
    },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    actionSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 20, paddingBottom: 36,
    },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 20, maxHeight: '75%',
    },
    sheetHandle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 16,
    },
    sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
    sheetSub:   { fontSize: 13, color: colors.gray, marginBottom: 14 },

    emojiRow: {
        flexDirection: 'row', justifyContent: 'space-around',
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
        marginBottom: 8,
    },
    emojiBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
    emojiText: { fontSize: 26 },

    actionRow: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
    },
    actionLabel: { fontSize: 15, color: colors.text, fontWeight: '500' },

    pinnedMsg: {
        backgroundColor: '#F8F8FC', borderRadius: 10, padding: 12, marginBottom: 8,
        borderLeftWidth: 3, borderLeftColor: colors.warning,
    },
    pinnedMsgHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    pinnedMsgSender:  { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
    pinnedMsgTime:    { fontSize: 11, color: colors.gray },
    pinnedMsgContent: { fontSize: 13, color: colors.text, lineHeight: 20 },

    memberListRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
    },
    memberListName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },

    adminPill: {
        backgroundColor: colors.primary + '15', borderRadius: 999,
        paddingHorizontal: 7, paddingVertical: 2,
    },
    adminPillText: { fontSize: 10, fontWeight: '700', color: colors.primary },
});