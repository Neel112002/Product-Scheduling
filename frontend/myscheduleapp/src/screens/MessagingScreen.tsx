// src/screens/MessagingScreen.tsx
import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, Pressable,
    RefreshControl, ActivityIndicator, TextInput, Alert, Modal,
    ScrollView, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { MessagingAPI, AdminAPI } from '../api/api';
import { AuthContext } from '../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type ChannelData = {
    channel_id: number;
    name: string;
    channel_type: 'general' | 'role' | 'group' | 'direct' | 'broadcast' | 'shift';
    is_broadcast: boolean;
    description?: string | null;
    unread: number;
    member_count: number;
    last_message?: {
        content: string;
        sender_name: string;
        created_at: string;
    } | null;
};

// ── Config ────────────────────────────────────────────────────────────────────

const CHANNEL_ICONS: Record<string, { icon: any; color: string }> = {
    general: { icon: 'people-outline', color: '#10B981' },
    role: { icon: 'briefcase-outline', color: '#6366F1' },
    group: { icon: 'chatbubbles-outline', color: colors.primary },
    direct: { icon: 'chatbubble-outline', color: '#F59E0B' },
    broadcast: { icon: 'megaphone-outline', color: '#EF4444' },
    shift: { icon: 'calendar-outline', color: '#0EA5E9' },
};

const SECTION_ORDER = ['broadcast', 'general', 'role', 'group', 'direct', 'shift'];
const SECTION_LABELS: Record<string, string> = {
    broadcast: '📢 Announcements',
    general: '🌐 General',
    role: '👥 Role Channels',
    group: '🔒 Groups',
    direct: '💬 Direct Messages',
    shift: '📋 Shift Threads',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MessagingScreen({ navigation }: any) {
    const { user: authUser } = useContext(AuthContext);

    const [channels, setChannels] = useState<ChannelData[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [newTab, setNewTab] = useState<'group' | 'dm'>('group');

    // Group creation
    const [groupName, setGroupName] = useState('');
    const [groupBroadcast, setGroupBroadcast] = useState(false);
    const [groupDesc, setGroupDesc] = useState('');
    const [colleagues, setColleagues] = useState<any[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<Set<number>>(new Set());
    const [creating, setCreating] = useState(false);

    const isManager = ['owner', 'manager'].includes(
        authUser?.role?.name?.toLowerCase() ?? ''
    );

    // ── Fetch channels ────────────────────────────────────────────────────────
    const fetchChannels = useCallback(async () => {
        try {
            const { data } = await MessagingAPI.getChannels();
            const list: ChannelData[] = data?.channels ?? [];
            if (list.length === 0) {
                // Auto-init channels on first load
                await MessagingAPI.setupChannels();
                const retry = await MessagingAPI.getChannels();
                setChannels(retry.data?.channels ?? []);
            } else {
                setChannels(list);
            }
        } catch {
            Alert.alert('Error', 'Could not load channels.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchChannels(); }, [fetchChannels]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchChannels();
        setRefreshing(false);
    }, [fetchChannels]);

    // ── Fetch colleagues for group/DM creation ────────────────────────────────
    const fetchColleagues = useCallback(async () => {
        try {
            const locId = authUser?.primaryLocation?.id;
            if (!locId) return;
            const { data } = await AdminAPI.listStaff(locId);
            setColleagues((data?.staff ?? []).filter((c: any) => c.user_id !== authUser?.id));
        } catch { }
    }, [authUser]);

    const openNew = () => {
        fetchColleagues();
        setGroupName('');
        setGroupBroadcast(false);
        setGroupDesc('');
        setSelectedMembers(new Set());
        setNewTab('group');
        setShowNew(true);
    };

    // ── Create group ──────────────────────────────────────────────────────────
    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            Alert.alert('Error', 'Group name is required.');
            return;
        }
        setCreating(true);
        try {
            const { data } = await MessagingAPI.createGroup({
                name: groupName.trim(),
                member_ids: Array.from(selectedMembers),
                is_broadcast: groupBroadcast,
                description: groupDesc.trim() || undefined,
            });
            setShowNew(false);
            await fetchChannels();
            navigation.navigate('Chat', {
                channelId: data.channel.channel_id,
                channelName: data.channel.name,
                channelType: data.channel.channel_type,
            });
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to create group.');
        } finally {
            setCreating(false);
        }
    };

    // ── Open DM ───────────────────────────────────────────────────────────────
    const handleOpenDM = async (colleague: any) => {
        setCreating(true);
        try {
            const { data } = await MessagingAPI.getDM(colleague.user_id);
            setShowNew(false);
            await fetchChannels();
            navigation.navigate('Chat', {
                channelId: data.channel.channel_id,
                channelName: data.channel.name,
                channelType: 'direct',
            });
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Failed.');
        } finally {
            setCreating(false);
        }
    };

    // ── Navigate to chat ──────────────────────────────────────────────────────
    const openChannel = (ch: ChannelData) => {
        navigation.navigate('Chat', {
            channelId: ch.channel_id,
            channelName: ch.name,
            channelType: ch.channel_type,
        });
    };

    // ── Filtered + grouped channels ───────────────────────────────────────────
    const filtered = channels.filter(ch =>
        ch.name.toLowerCase().includes(search.toLowerCase())
    );

    const grouped: Record<string, ChannelData[]> = {};
    SECTION_ORDER.forEach(type => { grouped[type] = []; });
    filtered.forEach(ch => {
        if (grouped[ch.channel_type]) grouped[ch.channel_type].push(ch);
    });

    const sections = SECTION_ORDER
        .filter(type => grouped[type].length > 0)
        .map(type => ({ type, channels: grouped[type] }));

    const totalUnread = channels.reduce((acc, ch) => acc + ch.unread, 0);

    // ── Render channel row ────────────────────────────────────────────────────
    const renderChannel = (ch: ChannelData) => {
        const cfg = CHANNEL_ICONS[ch.channel_type] ?? CHANNEL_ICONS.group;
        return (
            <Pressable key={ch.channel_id} style={styles.channelRow} onPress={() => openChannel(ch)}>
                <View style={[styles.channelIcon, { backgroundColor: cfg.color + '18' }]}>
                    <Ionicons name={cfg.icon} size={20} color={cfg.color} />
                </View>
                <View style={styles.channelInfo}>
                    <View style={styles.channelTop}>
                        <Text style={styles.channelName} numberOfLines={1}>{ch.name}</Text>
                        {ch.last_message && (
                            <Text style={styles.channelTime}>
                                {timeAgo(ch.last_message.created_at)}
                            </Text>
                        )}
                    </View>
                    {ch.last_message ? (
                        <Text style={styles.channelPreview} numberOfLines={1}>
                            <Text style={styles.channelPreviewSender}>
                                {ch.last_message.sender_name === 'System' ? '' : `${ch.last_message.sender_name}: `}
                            </Text>
                            {ch.last_message.content}
                        </Text>
                    ) : (
                        <Text style={styles.channelPreview}>{ch.description ?? 'No messages yet'}</Text>
                    )}
                </View>
                {ch.unread > 0 && (
                    <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{ch.unread > 99 ? '99+' : ch.unread}</Text>
                    </View>
                )}
            </Pressable>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>
            {/* Header */}
            <View style={styles.header}>
                {navigation.canGoBack() && (
                    <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color={colors.text} />
                    </Pressable>
                )}
                <Text style={styles.headerTitle}>
                    Messages
                    {totalUnread > 0 && (
                        <Text style={styles.headerUnread}> ({totalUnread})</Text>
                    )}
                </Text>
                <Pressable style={styles.newBtn} onPress={openNew}>
                    <Ionicons name="add" size={22} color="#fff" />
                </Pressable>
            </View>

            {/* Search */}
            <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={16} color={colors.gray} />
                <TextInput
                    style={styles.searchInput}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search channels..."
                    placeholderTextColor={colors.gray}
                />
                {search.length > 0 && (
                    <Pressable onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={16} color={colors.gray} />
                    </Pressable>
                )}
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {sections.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="chatbubbles-outline" size={52} color={colors.inputBorder} />
                            <Text style={styles.emptyTitle}>No channels yet</Text>
                            <Text style={styles.emptySub}>
                                Tap + to create a group or start a DM.
                            </Text>
                        </View>
                    ) : (
                        sections.map(section => (
                            <View key={section.type}>
                                <Text style={styles.sectionLabel}>{SECTION_LABELS[section.type]}</Text>
                                <View style={styles.sectionCard}>
                                    {section.channels.map(ch => renderChannel(ch))}
                                </View>
                            </View>
                        ))
                    )}
                    <View style={{ height: 40 }} />
                </ScrollView>
            )}

            {/* New channel modal */}
            <Modal visible={showNew} transparent animationType="slide" onRequestClose={() => setShowNew(false)}>
                <Pressable style={styles.overlay} onPress={() => setShowNew(false)}>
                    <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>New Conversation</Text>

                        {/* Tabs */}
                        <View style={styles.newTabBar}>
                            {isManager && (
                                <Pressable
                                    style={[styles.newTab, newTab === 'group' && styles.newTabActive]}
                                    onPress={() => setNewTab('group')}
                                >
                                    <Text style={[styles.newTabText, newTab === 'group' && styles.newTabTextActive]}>
                                        Group
                                    </Text>
                                </Pressable>
                            )}
                            <Pressable
                                style={[styles.newTab, newTab === 'dm' && styles.newTabActive]}
                                onPress={() => setNewTab('dm')}
                            >
                                <Text style={[styles.newTabText, newTab === 'dm' && styles.newTabTextActive]}>
                                    Direct Message
                                </Text>
                            </Pressable>
                        </View>

                        <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
                            {newTab === 'group' && isManager ? (
                                <View style={{ gap: 14 }}>
                                    <TextInput
                                        style={styles.input}
                                        value={groupName}
                                        onChangeText={setGroupName}
                                        placeholder="Group name..."
                                        placeholderTextColor={colors.gray}
                                    />
                                    <TextInput
                                        style={styles.input}
                                        value={groupDesc}
                                        onChangeText={setGroupDesc}
                                        placeholder="Description (optional)"
                                        placeholderTextColor={colors.gray}
                                    />
                                    <View style={styles.broadcastRow}>
                                        <View>
                                            <Text style={styles.broadcastLabel}>📢 Broadcast Channel</Text>
                                            <Text style={styles.broadcastSub}>Only you can post. Others can read.</Text>
                                        </View>
                                        <Switch
                                            value={groupBroadcast}
                                            onValueChange={setGroupBroadcast}
                                            trackColor={{ true: colors.primary }}
                                            thumbColor="#fff"
                                        />
                                    </View>

                                    <Text style={styles.membersLabel}>
                                        Add Members ({selectedMembers.size} selected)
                                    </Text>
                                    {colleagues.map(c => (
                                        <Pressable
                                            key={c.user_id}
                                            style={styles.memberRow}
                                            onPress={() => {
                                                const s = new Set(selectedMembers);
                                                s.has(c.user_id) ? s.delete(c.user_id) : s.add(c.user_id);
                                                setSelectedMembers(s);
                                            }}
                                        >
                                            <View style={styles.memberAvatar}>
                                                <Text style={styles.memberAvatarText}>
                                                    {(c.display_name || c.username || '?')[0].toUpperCase()}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.memberName}>{c.display_name || c.username}</Text>
                                                {c.role && <Text style={styles.memberRole}>{c.role}</Text>}
                                            </View>
                                            <View style={[
                                                styles.checkCircle,
                                                selectedMembers.has(c.user_id) && styles.checkCircleActive,
                                            ]}>
                                                {selectedMembers.has(c.user_id) && (
                                                    <Ionicons name="checkmark" size={13} color="#fff" />
                                                )}
                                            </View>
                                        </Pressable>
                                    ))}

                                    <Pressable
                                        style={[styles.createBtn, creating && { opacity: 0.6 }]}
                                        onPress={handleCreateGroup}
                                        disabled={creating}
                                    >
                                        {creating
                                            ? <ActivityIndicator size="small" color="#fff" />
                                            : <Text style={styles.createBtnText}>
                                                Create {groupBroadcast ? 'Broadcast' : 'Group'}
                                            </Text>
                                        }
                                    </Pressable>
                                </View>
                            ) : (
                                <View>
                                    <Text style={styles.membersLabel}>Select a colleague</Text>
                                    {colleagues.map(c => (
                                        <Pressable
                                            key={c.user_id}
                                            style={styles.memberRow}
                                            onPress={() => handleOpenDM(c)}
                                            disabled={creating}
                                        >
                                            <View style={styles.memberAvatar}>
                                                <Text style={styles.memberAvatarText}>
                                                    {(c.display_name || c.username || '?')[0].toUpperCase()}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.memberName}>{c.display_name || c.username}</Text>
                                                {c.role && <Text style={styles.memberRole}>{c.role}</Text>}
                                            </View>
                                            <Ionicons name="chevron-forward" size={16} color={colors.gray} />
                                        </Pressable>
                                    ))}
                                </View>
                            )}
                            <View style={{ height: 20 }} />
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8F8FC' },
    scroll: { flex: 1 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    backBtn: { padding: 4, marginRight: 8 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
    headerUnread: { color: colors.primary },
    newBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center',
    },

    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        margin: 12, paddingHorizontal: 12, paddingVertical: 10,
        backgroundColor: '#fff', borderRadius: 12,
        borderWidth: 1, borderColor: '#EFEFEF',
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.text },

    sectionLabel: {
        fontSize: 11, fontWeight: '700', color: colors.gray,
        letterSpacing: 0.5, paddingHorizontal: 16,
        paddingTop: 16, paddingBottom: 6,
    },
    sectionCard: {
        backgroundColor: '#fff',
        marginHorizontal: 12, borderRadius: 14,
        borderWidth: 1, borderColor: '#EFEFEF',
        overflow: 'hidden',
    },

    channelRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
        gap: 12,
    },
    channelIcon: {
        width: 42, height: 42, borderRadius: 21,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    channelInfo: { flex: 1, minWidth: 0 },
    channelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    channelName: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 },
    channelTime: { fontSize: 11, color: colors.gray, marginLeft: 8 },
    channelPreview: { fontSize: 12, color: colors.gray, marginTop: 2 },
    channelPreviewSender: { fontWeight: '600' },
    unreadBadge: {
        minWidth: 20, height: 20, borderRadius: 10,
        backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 5, flexShrink: 0,
    },
    unreadBadgeText: { fontSize: 10, color: '#fff', fontWeight: '800' },

    emptyContainer: { alignItems: 'center', paddingVertical: 60, gap: 10 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    emptySub: { fontSize: 13, color: colors.gray, textAlign: 'center' },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 20, maxHeight: '85%',
    },
    sheetHandle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 16,
    },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },

    newTabBar: { flexDirection: 'row', marginBottom: 16, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.inputBorder },
    newTab: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#FAFAFA' },
    newTabActive: { backgroundColor: colors.primary },
    newTabText: { fontSize: 13, fontWeight: '600', color: colors.gray },
    newTabTextActive: { color: '#fff' },

    input: {
        borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 14, color: colors.text, backgroundColor: '#FAFAFA',
    },
    broadcastRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    broadcastLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    broadcastSub: { fontSize: 12, color: colors.gray, marginTop: 2 },

    membersLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 },
    memberRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
    },
    memberAvatar: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: colors.primary + '20',
        alignItems: 'center', justifyContent: 'center',
    },
    memberAvatarText: { fontSize: 15, fontWeight: '700', color: colors.primary },
    memberName: { fontSize: 14, fontWeight: '600', color: colors.text },
    memberRole: { fontSize: 12, color: colors.gray, marginTop: 2 },
    checkCircle: {
        width: 24, height: 24, borderRadius: 12,
        borderWidth: 2, borderColor: colors.inputBorder,
        alignItems: 'center', justifyContent: 'center',
    },
    checkCircleActive: { backgroundColor: colors.primary, borderColor: colors.primary },

    createBtn: {
        backgroundColor: colors.primary, borderRadius: 999,
        paddingVertical: 14, alignItems: 'center', marginTop: 8,
    },
    createBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});