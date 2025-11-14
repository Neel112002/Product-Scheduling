// src/navigation/AppStack.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import ProfileSettingsScreen from '../screens/ProfileSettingsScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';

export type AppStackParamList = {
    Dashboard: undefined;
    AdminDashboard: undefined;
    ProfileSettings: undefined;
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
        </Stack.Navigator>
    );
}
