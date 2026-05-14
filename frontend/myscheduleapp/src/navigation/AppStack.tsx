// src/navigation/AppStack.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import ProfileSettingsScreen from '../screens/ProfileSettingsScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import InviteStaffScreen from '../screens/admin/InviteStaffScreen';
import TeamRolesScreen from '../screens/admin/TeamRolesScreen';
import CompleteProfileScreen from '../screens/CompleteProfileScreen';
import ScheduleScreen from '../screens/admin/ScheduleScreen';
import CreateShiftScreen from '../screens/admin/CreateShiftScreen';
import ShiftDetailScreen from '../screens/admin/ShiftDetailScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SwapShiftScreen from '../screens/SwapShiftScreen';
import MySwapsScreen from '../screens/MySwapsScreen';

export type AppStackParamList = {
    Dashboard: undefined;
    AdminDashboard: undefined;
    ProfileSettings: undefined;
    InviteStaff: undefined;
    TeamRoles: undefined;
    CompleteProfile: undefined;
    Notifications: undefined;
    SwapShift: undefined;
    MySwaps: undefined;
    // ── Schedule ──────────────────────────────
    Schedule: { locationId?: number | null };
    CreateShift: { locationId: number; date: string };
    ShiftDetail: { shiftId: number; locationId: number };
};

const Stack = createNativeStackNavigator<AppStackParamList>();

type Props = {
    initialRoute?: keyof AppStackParamList;
};

export default function AppStack({ initialRoute = 'Dashboard' }: Props) {
    return (
        <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{
                headerTintColor: '#7B4AE2',
                headerTitleAlign: 'center',
                headerShadowVisible: false,
                animation: 'slide_from_right',
            }}
        >
            {/* ── Employee ────────────────────────────────────── */}
            <Stack.Screen
                name="Dashboard"
                component={HomeScreen}
                options={{ headerShown: false }}
            />

            {/* ── Admin ───────────────────────────────────────── */}
            <Stack.Screen
                name="AdminDashboard"
                component={AdminDashboardScreen}
                options={{ headerShown: false }}
            />

            <Stack.Screen
                name="Schedule"
                component={ScheduleScreen}
                options={{ headerShown: false }}
            />

            <Stack.Screen
                name="CreateShift"
                component={CreateShiftScreen}
                options={{
                    headerShown: false,
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                }}
            />

            <Stack.Screen
                name="ShiftDetail"
                component={ShiftDetailScreen}
                options={{
                    headerShown: false,
                    animation: 'slide_from_right',
                }}
            />

            <Stack.Screen
                name="InviteStaff"
                component={InviteStaffScreen}
                options={{ headerShown: false }}
            />

            <Stack.Screen
                name="TeamRoles"
                component={TeamRolesScreen}
                options={{ title: 'Team & Roles' }}
            />

            {/* ── Shared ──────────────────────────────────────── */}
            <Stack.Screen
                name="ProfileSettings"
                component={ProfileSettingsScreen}
                options={{ title: 'Profile Settings' }}
            />

            <Stack.Screen
                name="CompleteProfile"
                component={CompleteProfileScreen}
                options={{ title: 'Complete your profile' }}
            />

            <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
                options={{ headerShown: false }}
            />

            <Stack.Screen
                name="SwapShift"
                component={SwapShiftScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="MySwaps"
                component={MySwapsScreen}
                options={{ headerShown: false }}
            />
        </Stack.Navigator>
    );
}