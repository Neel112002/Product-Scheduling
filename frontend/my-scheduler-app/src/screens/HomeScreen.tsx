// src/screens/HomeScreen.tsx
import React, {
    useCallback,
    useMemo,
    useState,
    useContext,
    useEffect,
} from 'react';
import { ScrollView, RefreshControl, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

import HeaderGreeting from '../components/home/HeaderGreeting';
import NextShiftCard, { Shift } from '../components/home/NextShiftCard';
import QuickActionsCard from '../components/home/QuickActionsCard';
import TeamOnDutyCard, { TeamMember } from '../components/home/TeamOnDutyCard';
import AlertsCard, { AlertItem } from '../components/home/AlertsCard';
import FloatingActionButton from '../components/home/FloatingActionButton';
import { AuthContext } from '../context/AuthContext';
import { api } from '../api/api';

// ---- Types for dynamic data ----
type LocationOption = {
    id: number;
    name: string;
};

// ---- Still mock for now (can wire later) ----
const mockTeamToday: TeamMember[] = [
    { id: 'u1', name: 'Alex Johnson', status: 'on' },
    { id: 'u2', name: 'Priya Singh', status: 'break' },
    { id: 'u3', name: 'Marco Chen', status: 'on' },
    { id: 'u4', name: 'Sofia Reyes', status: 'off' },
    { id: 'u5', name: 'Liam Patel', status: 'on' },
];

const mockAlerts: AlertItem[] = [
    {
        id: 'a1',
        icon: 'swap-horizontal',
        title: 'Shift swap requested',
        subtitle: 'Alex → Priya (Today 4–8 PM)',
        tone: 'info',
    },
    {
        id: 'a2',
        icon: 'time-outline',
        title: 'Overtime threshold near',
        subtitle: 'Marco at 38.5h this week',
        tone: 'warn',
    },
    {
        id: 'a3',
        icon: 'megaphone-outline',
        title: 'Team meeting today',
        subtitle: '4:00 PM • Back office',
    },
];

export default function HomeScreen({ navigation }: any) {
    const { logout, user } = useContext(AuthContext);

    const [refreshing, setRefreshing] = useState(false);

    const [locations, setLocations] = useState<LocationOption[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
        null
    );
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loadingShifts, setLoadingShifts] = useState(false);

    // ---------- Derived UI bits ----------
    const displayName = useMemo(
        () => user?.display_name || user?.username || 'Employee',
        [user]
    );

    const initials = useMemo(() => {
        const base = displayName || '';
        const parts = base.trim().split(/\s+/);
        if (!parts.length) return 'ME';
        const letters = parts.map((p) => p[0]).join('');
        return letters.slice(0, 2).toUpperCase();
    }, [displayName]);

    const selectedLocationName = useMemo(() => {
        if (!selectedLocationId) return 'Select location';
        const loc = locations.find((l) => l.id === selectedLocationId);
        return loc?.name ?? 'Select location';
    }, [locations, selectedLocationId]);

    const locationNames = useMemo(
        () => locations.map((l) => l.name),
        [locations]
    );

    // ---------- Load locations once ----------
    useEffect(() => {
        let mounted = true;

        const loadLocations = async () => {
            try {
                // adjust path to your real endpoint
                const res = await api.get('/employee/locations');
                const list: LocationOption[] = res.data?.locations ?? [];

                if (!mounted) return;

                setLocations(list);

                // default to user.home location if present, else first
                const byUser =
                    list.find((l) => l.id === user?.location_id) ?? list[0];
                if (byUser) setSelectedLocationId(byUser.id);
            } catch (err) {
                console.error('[Home] loadLocations error', err);
            }
        };

        loadLocations();
        return () => {
            mounted = false;
        };
    }, [user?.location_id]);

    // ---------- Load shifts whenever location changes ----------
    const fetchShifts = useCallback(
        async (locId: number | null) => {
            if (!locId) {
                setShifts([]);
                return;
            }
            setLoadingShifts(true);
            try {
                // adjust path/shape to match your backend
                const res = await api.get(
                    `/employee/locations/${locId}/shifts`
                );

                const raw = res.data?.shifts ?? [];
                // map backend fields -> NextShiftCard Shift type
                const mapped: Shift[] = raw.map((s: any) => ({
                    id: String(s.shift_id ?? s.id),
                    role: s.role ?? s.position ?? 'Shift',
                    location: s.location_name ?? s.location ?? '',
                    startISO: s.start_time ?? s.startISO,
                    endISO: s.end_time ?? s.endISO,
                    // Optional: punch state fields if backend sends them
                    punchState: s.punch_state, // 'not-started' | 'ongoing' | 'break' | 'finished'
                    breakFromISO: s.break_from,
                }));

                setShifts(mapped);
            } catch (err) {
                console.error('[Home] fetchShifts error', err);
                setShifts([]);
            } finally {
                setLoadingShifts(false);
            }
        },
        []
    );

    useEffect(() => {
        fetchShifts(selectedLocationId);
    }, [selectedLocationId, fetchShifts]);

    // ---------- Pull-to-refresh ----------
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([
            fetchShifts(selectedLocationId),
            // you could also reload locations / team / alerts here later
        ]);
        setRefreshing(false);
    }, [fetchShifts, selectedLocationId]);

    // ---------- Handlers ----------
    const handleChangeLocation = (name: string) => {
        const loc = locations.find((l) => l.name === name);
        if (loc) setSelectedLocationId(loc.id);
    };

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={{ padding: 16 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing || loadingShifts}
                        onRefresh={onRefresh}
                    />
                }
            >
                <HeaderGreeting
                    name={displayName}
                    initials={initials}
                    onAvatarPress={() => navigation.navigate?.('ProfileSettings')}
                    locations={locationNames}
                    selectedLocation={selectedLocationName}
                    onChangeLocation={handleChangeLocation}
                    onLogout={logout}
                />

                {/* Row: Shifts + Quick Actions */}
                <View style={styles.row}>
                    <NextShiftCard
                        upcoming={shifts}
                        maxListHeight={260}
                        onViewSchedule={() =>
                            navigation.navigate?.('Schedule', {
                                locationId: selectedLocationId,
                            })
                        }
                    />

                    <QuickActionsCard
                        actions={[
                            {
                                icon: 'swap-horizontal',
                                label: 'Swap shift',
                                onPress: () =>
                                    navigation.navigate?.('SwapShift', {
                                        locationId: selectedLocationId,
                                    }),
                            },
                            {
                                icon: 'sunny-outline',
                                label: 'Request time off',
                                onPress: () =>
                                    navigation.navigate?.('TimeOff', {
                                        locationId: selectedLocationId,
                                    }),
                            },
                            {
                                icon: 'checkmark-done-outline',
                                label: 'Availability',
                                onPress: () =>
                                    navigation.navigate?.('Availability', {
                                        locationId: selectedLocationId,
                                    }),
                            },
                            {
                                icon: 'chatbubble-ellipses-outline',
                                label: 'Instant chat',
                                onPress: () =>
                                    navigation.navigate?.('Chat', {
                                        locationId: selectedLocationId,
                                    }),
                            },
                        ]}
                    />
                </View>

                <TeamOnDutyCard members={mockTeamToday} />
                <AlertsCard alerts={mockAlerts} onItemPress={() => { }} />

                {/* If you don’t want a FAB for employees, remove this */}
                {/* <FloatingActionButton onPress={() => {}} /> */}

                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1 },
    row: { flexDirection: 'row', gap: 12 },
});
