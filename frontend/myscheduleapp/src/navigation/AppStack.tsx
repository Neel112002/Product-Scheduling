// src/navigation/AppStack.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// ── Screens ───────────────────────────────────────────────────────────────────
import HomeScreen from '../screens/HomeScreen';
import ProfileSettingsScreen from '../screens/ProfileSettingsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SwapShiftScreen from '../screens/SwapShiftScreen';
import MySwapsScreen from '../screens/MySwapsScreen';
import ClockInScreen from '../screens/ClockInScreen';
import TimesheetScreen from '../screens/TimesheetScreen';
import TeamStatusScreen from '../screens/TeamStatusScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import InviteStaffScreen from '../screens/admin/InviteStaffScreen';
import TeamRolesScreen from '../screens/admin/TeamRolesScreen';
import ScheduleScreen from '../screens/admin/ScheduleScreen';
import WeekScheduleScreen from '../screens/admin/WeekScheduleScreen';
import CreateShiftScreen from '../screens/admin/CreateShiftScreen';
import ShiftDetailScreen from '../screens/admin/ShiftDetailScreen';
import ClockManagementScreen from '../screens/admin/ClockManagementScreen';
import ClockSettingsScreen from '../screens/admin/ClockSettingsScreen';
import AIAssistantScreen from '../screens/admin/AIAssistantScreen';
import CompleteProfileScreen from '../screens/CompleteProfileScreen';
import EmployeeProfileScreen from '../screens/admin/EmployeeProfileScreen';
import AnalyticsScreen from '../screens/admin/AnalyticsScreen';
import AvailabilityScreen from '../screens/AvailabilityScreen';
import TimeOffScreen from '../screens/TimeOffScreen';
import AdminRequestsScreen from '../screens/admin/AdminRequestsScreen';


// ── Param list ────────────────────────────────────────────────────────────────
export type AppStackParamList = {
    // Employee
    Dashboard: undefined;
    ProfileSettings: undefined;
    Notifications: undefined;
    SwapShift: undefined;
    MySwaps: undefined;
    ClockIn: undefined;
    Timesheet: undefined;
    TeamStatus: { locationId?: number | null };
    Availability: undefined;
    TimeOff: undefined;

    // Admin
    AdminDashboard: undefined;
    InviteStaff: undefined;
    TeamRoles: undefined;
    Schedule: { locationId?: number | null };
    WeekSchedule: { locationId?: number | null };
    CreateShift: { locationId: number; date: string };
    ShiftDetail: { shiftId: number; locationId: number };
    ClockManagement: { locationId: number };
    ClockSettings: undefined;
    AIAssistant: undefined;
    EmployeeProfile: { userId: number; locationId: number };
    Analytics: { locationId?: number };
    AdminRequests: { locationId?: number };


    // Shared
    CompleteProfile: undefined;
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
            {/* ── Employee screens ──────────────────────────────────────── */}
            <Stack.Screen
                name="Dashboard"
                component={HomeScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="ProfileSettings"
                component={ProfileSettingsScreen}
                options={{ headerShown: false }}
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
            <Stack.Screen
                name="ClockIn"
                component={ClockInScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Timesheet"
                component={TimesheetScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="TeamStatus"
                component={TeamStatusScreen}
                options={{ headerShown: false }}
            />

            {/* ── Admin screens ─────────────────────────────────────────── */}
            <Stack.Screen
                name="AdminDashboard"
                component={AdminDashboardScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="InviteStaff"
                component={InviteStaffScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="TeamRoles"
                component={TeamRolesScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Schedule"
                component={ScheduleScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="WeekSchedule"
                component={WeekScheduleScreen}
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
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="ClockManagement"
                component={ClockManagementScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="ClockSettings"
                component={ClockSettingsScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="AIAssistant"
                component={AIAssistantScreen}
                options={{ headerShown: false }}
            />

            {/* ── Shared ───────────────────────────────────────────────── */}
            <Stack.Screen
                name="CompleteProfile"
                component={CompleteProfileScreen}
                options={{ title: 'Complete your profile' }}
            />
            <Stack.Screen
                name="EmployeeProfile"
                component={EmployeeProfileScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Analytics"
                component={AnalyticsScreen}
                options={{ headerShown: false }}
            />

            <Stack.Screen
                name="Availability"
                component={AvailabilityScreen}
                options={{ headerShown: false }}
            />

            <Stack.Screen
                name="TimeOff"
                component={TimeOffScreen}
                options={{ headerShown: false }}
            />

            <Stack.Screen
                name="AdminRequests"
                component={AdminRequestsScreen}
                options={{ headerShown: false }}
            />
        </Stack.Navigator>
    );
}