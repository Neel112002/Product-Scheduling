// src/navigation/AppStack.tsx

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import ProfileSettingsScreen from '../screens/ProfileSettingsScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import InviteStaffScreen from '../screens/admin/InviteStaffScreen';
import TeamRolesScreen from '../screens/admin/TeamRolesScreen';
import CompleteProfileScreen from '../screens/CompleteProfileScreen';

export type AppStackParamList = {
    Dashboard: undefined;
    AdminDashboard: undefined;
    ProfileSettings: undefined;
    InviteStaff: undefined;
    TeamRoles: undefined;        // ✅ Added
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
            }}
        >
            <Stack.Screen
                name="Dashboard"
                component={HomeScreen}
                options={{ headerShown: false }}
            />

            <Stack.Screen
                name="AdminDashboard"
                component={AdminDashboardScreen}
                options={{ title: 'Admin Dashboard' }}
            />

            <Stack.Screen
                name="ProfileSettings"
                component={ProfileSettingsScreen}
                options={{ title: 'Profile Settings' }}
            />

            <Stack.Screen
                name="InviteStaff"
                component={InviteStaffScreen}
                options={{
                    title: 'Invite Staff',
                    headerShown: false,
                }}
            />

            {/* ✅ NEW SCREEN */}
            <Stack.Screen
                name="TeamRoles"
                component={TeamRolesScreen}
                options={{ title: 'Team & Roles' }}
            />

            <Stack.Screen
                name="CompleteProfile"
                component={CompleteProfileScreen}
                options={{ title: 'Complete your profile' }}
            />
        </Stack.Navigator>
    );
}