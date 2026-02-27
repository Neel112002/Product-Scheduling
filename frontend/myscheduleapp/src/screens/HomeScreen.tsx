// src/screens/HomeScreen.tsx
import React, {
    useCallback,
    useMemo,
    useState,
    useContext,
} from 'react';
import {
    ScrollView,
    RefreshControl,
    View,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@apollo/client/react';

import { colors } from '../theme/colors';
import HeaderGreeting from '../components/home/HeaderGreeting';
import NextShiftCard, { Shift } from '../components/home/NextShiftCard';
import QuickActionsCard from '../components/home/QuickActionsCard';
import TeamOnDutyCard, { TeamMember } from '../components/home/TeamOnDutyCard';
import AlertsCard, { AlertItem } from '../components/home/AlertsCard';
import { AuthContext } from '../context/AuthContext';
import {
    ME_QUERY,
    MY_LOCATIONS_QUERY,
    SHIFTS_BY_LOCATION_QUERY,
} from '../graphql/operations';

// ─── Static mocks for now ─────────────────────────────────────
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
        icon: 'notifications-outline',
        title: 'Team meeting today',
        subtitle: '4:00 PM • Back office',
    },
];

// ---- Types for dynamic data ----
export type LocationOption = {
    id: number;
    name: string;
    address?: string | null;
};

type MeQueryData = {
    me: {
        user_id: number;
        username: string;
        user_email: string;
        display_name?: string | null;
        role?: string | null;
        company?: { id: number; name: string } | null;
        primaryLocation?: { id: number; name: string } | null;
    } | null;
};

type MyLocationsQueryData = {
    myLocations: LocationOption[];
};

type ShiftsByLocationData = {
    shiftsByLocation: {
        id: number;
        role?: string | null;
        startTime: string;
        endTime: string;
        location: {
            id: number;
            name: string;
        };
    }[];
};

export default function HomeScreen({ navigation }: any) {
    const { logout, user: authUser } = useContext(AuthContext);

    const [refreshing, setRefreshing] = useState(false);
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
        authUser?.primaryLocation?.id ?? null,
    );

    // 1) Get fresh user (me) from GraphQL
    const { data: meData } = useQuery<MeQueryData>(ME_QUERY, {
        fetchPolicy: 'cache-first',
    });
    const graphUser = meData?.me ?? null;

    // 2) Locations accessible to this user
    const {
        data: locData,
        loading: loadingLocations,
        refetch: refetchLocations,
    } = useQuery<MyLocationsQueryData>(MY_LOCATIONS_QUERY, {
        fetchPolicy: 'cache-and-network',
    });

    const locations: LocationOption[] = locData?.myLocations ?? [];

    // default location: primaryLocation → first in list
    const effectivePrimaryLocationId =
        graphUser?.primaryLocation?.id ?? authUser?.primaryLocation?.id ?? null;

    if (!selectedLocationId && locations.length && effectivePrimaryLocationId) {
        const fromUser =
            locations.find((l) => l.id === effectivePrimaryLocationId) ??
            locations[0];
        if (fromUser && selectedLocationId == null) {
            // simple guard against re-render loops
            setSelectedLocationId(fromUser.id);
        }
    }

    // 3) Shifts for selected location (if any)
    const {
        data: shiftData,
        loading: loadingShifts,
        refetch: refetchShifts,
    } = useQuery<ShiftsByLocationData>(SHIFTS_BY_LOCATION_QUERY, {
        skip: !selectedLocationId,
        variables: { locationId: selectedLocationId ?? 0 },
        fetchPolicy: 'cache-and-network',
    });

    const shifts: Shift[] = useMemo(() => {
        const raw = shiftData?.shiftsByLocation ?? [];
        return raw.map((s) => ({
            id: String(s.id),
            role: s.role ?? 'Shift',
            location: s.location.name,
            startISO: s.startTime,
            endISO: s.endTime,
        }));
    }, [shiftData]);

    // ─── Derived UI values ────────────────────────────────────────
    const displayName = useMemo(
        () =>
            graphUser?.display_name ||
            graphUser?.username ||
            authUser?.display_name ||
            authUser?.username ||
            'Employee',
        [graphUser, authUser],
    );

    const initials = useMemo(() => {
        const base = displayName || '';
        const parts = base.trim().split(/\s+/);
        if (!parts.length) return 'ME';
        const letters = parts.map((p: string) => p[0]).join('');
        return letters.slice(0, 2).toUpperCase();
    }, [displayName]);

    const selectedLocationName = useMemo(() => {
        if (!selectedLocationId && graphUser?.primaryLocation?.name) {
            return graphUser.primaryLocation.name;
        }
        if (!selectedLocationId) return 'Assigned location';
        const loc = locations.find((l) => l.id === selectedLocationId);
        return (
            loc?.name ??
            graphUser?.primaryLocation?.name ??
            'Assigned location'
        );
    }, [locations, selectedLocationId, graphUser]);

    const locationNames = useMemo(
        () => locations.map((l) => l.name),
        [locations],
    );

    const showShifts: Shift[] = shifts ?? [];

    // ─── Handlers ─────────────────────────────────────────────────
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([
            refetchLocations(),
            selectedLocationId ? refetchShifts() : Promise.resolve(),
        ]);
        setRefreshing(false);
    }, [refetchLocations, refetchShifts, selectedLocationId]);

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
                        refreshing={refreshing || loadingShifts || loadingLocations}
                        onRefresh={onRefresh}
                    />
                }
            >
                <HeaderGreeting
                    name={displayName}
                    initials={initials}
                    onAvatarPress={() => navigation.navigate?.('ProfileSettings')}
                    locations={
                        locationNames.length ? locationNames : [selectedLocationName]
                    }
                    selectedLocation={selectedLocationName}
                    onChangeLocation={handleChangeLocation}
                    onLogout={logout}
                />

                {/* Row: Shifts + Quick Actions */}
                <View style={styles.row}>
                    <NextShiftCard
                        upcoming={showShifts}
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