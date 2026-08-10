// src/navigation/AppStack.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// ── Navigators ────────────────────────────────────────────────────────────────
import MainTabs from './MainTabs';

// ── Screens ───────────────────────────────────────────────────────────────────
import NotificationsScreen from '../screens/NotificationsScreen';
import SwapShiftScreen from '../screens/SwapShiftScreen';
import MySwapsScreen from '../screens/MySwapsScreen';
import ClockInScreen from '../screens/ClockInScreen';
import TimesheetScreen from '../screens/TimesheetScreen';
import TeamStatusScreen from '../screens/TeamStatusScreen';
import InviteStaffScreen from '../screens/admin/InviteStaffScreen';
import TeamRolesScreen from '../screens/admin/TeamRolesScreen';
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
import ChatScreen from '../screens/ChatScreen';


// ── Param list ────────────────────────────────────────────────────────────────
export type AppStackParamList = {
    // Home-base (rendered inside MainTabs — kept here only as stack entry points)
    Dashboard: undefined;
    AdminDashboard: undefined;

    // Employee
    Notifications: undefined;
    SwapShift: undefined;
    MySwaps: undefined;
    ClockIn: undefined;
    Timesheet: undefined;
    TeamStatus: { locationId?: number | null };
    Availability: undefined;
    TimeOff: undefined;

    // Admin
    InviteStaff: undefined;
    TeamRoles: undefined;
    WeekSchedule: { locationId?: number | null };
    CreateShift: { locationId: number; date: string };
    ShiftDetail: { shiftId: number; locationId: number };
    ClockManagement: { locationId: number };
    ClockSettings: undefined;
    AIAssistant: undefined;
    EmployeeProfile: { userId: number; locationId: number };
    Analytics: { locationId?: number };
    AdminRequests: { locationId?: number };
    Chat: { channelId: number; channelName: string; channelType: string };

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
            {/* ── Home base — both render MainTabs; it self-selects tabs by role ── */}
            <Stack.Screen
                name="Dashboard"
                component={MainTabs}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="AdminDashboard"
                component={MainTabs}
                options={{ headerShown: false }}
            />

            {/* ── Employee screens ──────────────────────────────────────── */}
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

            <Stack.Screen
                name="Chat"
                component={ChatScreen}
                options={{ headerShown: false }}
            />
        </Stack.Navigator>
    );
}