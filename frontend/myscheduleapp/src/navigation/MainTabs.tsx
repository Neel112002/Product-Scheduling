// src/navigation/MainTabs.tsx
import React, { useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { AuthContext } from '../context/AuthContext';

import HomeScreen from '../screens/HomeScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import ScheduleScreen from '../screens/admin/ScheduleScreen';
import MessagingScreen from '../screens/MessagingScreen';
import ProfileSettingsScreen from '../screens/ProfileSettingsScreen';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
    const { user } = useContext(AuthContext);
    const isManager = ['owner', 'manager', 'supervisor'].includes(
        (user?.role?.name ?? '').toLowerCase()
    );

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.gray,
                tabBarStyle: {
                    backgroundColor: '#fff',
                    borderTopWidth: 1,
                    borderTopColor: '#F0F0F0',
                    height: 62,
                    paddingBottom: 8,
                    paddingTop: 6,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                },
            }}
        >
            {isManager ? (
                <Tab.Screen
                    name="AdminHome"
                    component={AdminDashboardScreen}
                    options={{
                        tabBarLabel: 'Dashboard',
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="grid-outline" size={size} color={color} />
                        ),
                    }}
                />
            ) : (
                <Tab.Screen
                    name="Home"
                    component={HomeScreen}
                    options={{
                        tabBarLabel: 'Home',
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="home-outline" size={size} color={color} />
                        ),
                    }}
                />
            )}

            <Tab.Screen
                name="Schedule"
                component={ScheduleScreen}
                options={{
                    tabBarLabel: 'Schedule',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="calendar-outline" size={size} color={color} />
                    ),
                }}
            />

            <Tab.Screen
                name="Messaging"
                component={MessagingScreen}
                options={{
                    tabBarLabel: 'Messages',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="chatbubbles-outline" size={size} color={color} />
                    ),
                }}
            />

            <Tab.Screen
                name="ProfileSettings"
                component={ProfileSettingsScreen}
                options={{
                    tabBarLabel: 'Me',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="person-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
}