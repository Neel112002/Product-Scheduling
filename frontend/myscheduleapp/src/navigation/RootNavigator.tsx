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

import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from '../graphql/client';

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
    const { isAuthenticated, user, ready } = useContext(AuthContext);

    if (!ready) return null;

    const roleName = user?.role?.name?.toLowerCase();

    const isAdmin =
        roleName === 'owner' || roleName === 'manager';

    const initialAppRoute = isAdmin
        ? 'AdminDashboard'
        : 'Dashboard';

    return (
        <ApolloProvider client={apolloClient}>
            <NavigationContainer linking={linking}>
                <Root.Navigator
                    key={isAuthenticated ? `app-${initialAppRoute}` : 'auth'}
                    screenOptions={{ headerShown: false }}
                >
                    {isAuthenticated && user ? (
                        <Root.Screen
                            name="App"
                            children={() => (
                                <AppStack initialRoute={initialAppRoute} />
                            )}
                        />
                    ) : (
                        <Root.Screen name="Auth" component={AuthStack} />
                    )}
                </Root.Navigator>
            </NavigationContainer>
        </ApolloProvider>
    );
}