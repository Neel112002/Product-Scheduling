// src/navigation/RootNavigator.tsx
import React, { useContext } from 'react';
import {
    NavigationContainer,
    type LinkingOptions,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { AuthContext } from '../context/AuthContext';
import AuthStack from './AuthStack';
import AppStack from './AppStack';

type RootParamList = { Auth: undefined; App: undefined };
const Root = createNativeStackNavigator<RootParamList>();

const linking: LinkingOptions<RootParamList> = {
    prefixes: [Linking.createURL('/'), 'myscheduler://'],
    config: {
        screens: {
            Auth: {
                screens: {
                    Login: 'auth/login',
                    ForgotPasswordRequest: 'auth/forgot',
                    ResetPassword: 'auth/reset',
                },
            },
            App: {
                screens: {
                    Dashboard: 'dashboard',
                    AdminDashboard: 'admin/dashboard',
                },
            },
        },
    },
};

export default function RootNavigator() {
    const { isAuthenticated, role } = useContext(AuthContext);

    const isAdmin = role === 'owner' || role === 'manager';
    const initialAppRoute = isAdmin ? 'AdminDashboard' : 'Dashboard';

    console.log(
        '[Nav] role =',
        role,
        'isAdmin =',
        isAdmin,
        'initialAppRoute =',
        initialAppRoute
    );

    return (
        <NavigationContainer linking={linking}>
            <Root.Navigator
                key={isAuthenticated ? `app-${initialAppRoute}` : 'auth'}
                screenOptions={{ headerShown: false }}
            >
                {isAuthenticated && role ? (
                    <Root.Screen
                        name="App"
                        // pass initialRoute into AppStack
                        children={() => <AppStack initialRoute={initialAppRoute} />}
                    />
                ) : (
                    <Root.Screen name="Auth" component={AuthStack} />
                )}
            </Root.Navigator>
        </NavigationContainer>
    );
}
