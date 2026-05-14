// src/screens/HomeScreen.tsx
import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
    useContext,
} from 'react';
import { ScrollView, RefreshControl, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@apollo/client/react';

import { colors } from '../theme/colors';
import HeaderGreeting from '../components/home/HeaderGreeting';
import NextShiftCard, { Shift } from '../components/home/NextShiftCard';
import QuickActionsCard from '../components/home/QuickActionsCard';
import TeamOnDutyCard, { TeamMember } from '../components/home/TeamOnDutyCard';
import AlertsCard, { AlertItem } from '../components/home/AlertsCard';
import { AuthContext } from '../context/AuthContext';
import { MY_LOCATIONS_QUERY, SHIFTS_BY_LOCATION_QUERY } from '../graphql/operations';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LocationOption = {
    id: number;
    name: string;
    address?: string | null;
};

type MyLocationsData = {
    myLocations: LocationOption[];
};

type GQLShift = {
    id: number;
    role?: string | null;
    startTime: string;
    endTime: string;
    location: { id: number; name: string };
};

type ShiftsByLocationData = {
    shiftsByLocation: GQLShift[];
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockTeam: TeamMember[] = [
    { id: 'u1', name: 'Alex Johnson', status: 'on'    },
    { id: 'u2', name: 'Priya Singh',  status: 'break' },
    { id: 'u3', name: 'Marco Chen',   status: 'on'    },
];

const mockAlerts: AlertItem[] = [
    {
        id:       'a1',
        icon:     'swap-horizontal',
        title:    'Shift swap requested',
        subtitle: 'Alex → Priya (Today 4–8 PM)',
        tone:     'info',
    },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }: any) {
    const { logout, user: authUser } = useContext(AuthContext);

    const [refreshing, setRefreshing]               = useState(false);
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
        authUser?.primaryLocation?.id ?? null,
    );

    // ── Locations ─────────────────────────────────────────────────────────────
    const {
        data: locData,
        loading: loadingLoc,
        refetch: refetchLoc,
        error: locError,
    } = useQuery<MyLocationsData>(MY_LOCATIONS_QUERY, {
        fetchPolicy: 'cache-and-network',
    });

    const locations = locData?.myLocations ?? [];

    useEffect(() => {
        if (locations.length && !selectedLocationId) {
            const preferred = locations.find(
                l => l.id === authUser?.primaryLocation?.id
            );
            setSelectedLocationId(preferred?.id ?? locations[0].id);
        }
    }, [locations, selectedLocationId, authUser]);

    // ── Shifts ────────────────────────────────────────────────────────────────
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
        return (shiftData?.shiftsByLocation ?? []).map(s => ({
            id:       String(s.id),
            role:     s.role ?? 'Shift',
            location: s.location.name,
            startISO: s.startTime,
            endISO:   s.endTime,
        }));
    }, [shiftData]);

    // ── Derived values ────────────────────────────────────────────────────────
    const displayName = authUser?.display_name || authUser?.username || 'Employee';

    const initials = useMemo(() => {
        const parts = displayName.trim().split(/\s+/);
        return parts.map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
    }, [displayName]);

    const selectedLocationName = useMemo(() => {
        if (!selectedLocationId) return 'Assigned location';
        return locations.find(l => l.id === selectedLocationId)?.name ?? 'Assigned location';
    }, [locations, selectedLocationId]);

    const locationNames = useMemo(() => locations.map(l => l.name), [locations]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([
            refetchLoc(),
            selectedLocationId ? refetchShifts() : Promise.resolve(),
        ]).catch(() => {});
        setRefreshing(false);
    }, [refetchLoc, refetchShifts, selectedLocationId]);

    const handleChangeLocation = useCallback((name: string) => {
        const loc = locations.find(l => l.name === name);
        if (loc) setSelectedLocationId(loc.id);
    }, [locations]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={{ padding: 16 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing || loadingShifts || loadingLoc}
                        onRefresh={onRefresh}
                    />
                }
            >
                <HeaderGreeting
                    name={displayName}
                    initials={initials}
                    onAvatarPress={() => navigation.navigate?.('ProfileSettings')}
                    locations={locationNames.length ? locationNames : [selectedLocationName]}
                    selectedLocation={selectedLocationName}
                    onChangeLocation={handleChangeLocation}
                    onLogout={logout}
                />

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
                                icon:    'swap-horizontal',
                                label:   'Swap shift',
                                onPress: () => navigation.navigate?.('SwapShift'),
                            },
                            {
                                icon:    'sunny-outline',
                                label:   'Time off',
                                onPress: () => navigation.navigate?.('TimeOff'),
                            },
                            {
                                icon:    'checkmark-done-outline',
                                label:   'Availability',
                                onPress: () => navigation.navigate?.('Availability'),
                            },
                            {
                                icon:    'chatbubble-ellipses-outline',
                                label:   'Chat',
                                onPress: () => navigation.navigate?.('Chat'),
                            },
                        ]}
                    />
                </View>

                <TeamOnDutyCard members={mockTeam} />
                <AlertsCard alerts={mockAlerts} onItemPress={() => {}} />

                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe:      { flex: 1, backgroundColor: colors.background },
    container: { flex: 1 },
    row:       { flexDirection: 'row', gap: 12 },
});