// src/navigation/AppStack.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import ProfileSettingsScreen from '../screens/ProfileSettingsScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import InviteStaffScreen from '../screens/admin/InviteStaffScreen';

export type AppStackParamList = {
    Dashboard: undefined;
    AdminDashboard: undefined;
    ProfileSettings: undefined;
    InviteStaff: undefined;   // ✅ add this
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
                options={{
                    title: '',
                    headerShown: false, // clean, full-screen dashboard
                }}
            />

            <Stack.Screen
                name="AdminDashboard"
                component={AdminDashboardScreen}
                options={{
                    title: 'Admin Dashboard',
                }}
            />

            <Stack.Screen
                name="ProfileSettings"
                component={ProfileSettingsScreen}
                options={{
                    title: 'Profile Settings',
                }}
            />

            <Stack.Screen
                name="InviteStaff"
                component={InviteStaffScreen}
                options={{
                    title: 'Invite staff',
                    headerShown: false,
                }}
            />
        </Stack.Navigator>
    );
}
