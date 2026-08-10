// src/navigation/AuthStack.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import SignupWizardScreen from '../screens/SignupWizardScreen'; 
import ForgotPasswordRequestScreen from '../screens/ForgotPasswordRequestScreen';
import OtpScreen from '../screens/OtpScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import PasswordChangedScreen from '../screens/PasswordChangedScreen';

export type AuthStackParamList = {
    Login: undefined;  
    OwnerSignup: undefined;     
    ForgotPasswordRequest: undefined;
    Otp: undefined;
    ResetPassword: { token?: string } | undefined;
    PasswordChanged: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
    return (
        <Stack.Navigator
            initialRouteName="Login"
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
            }}
        >
            {/* No header on these */}
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen
                name="OwnerSignup"
                component={SignupWizardScreen}
                options={{
                    headerShown: false, // wizard has its own header UI
                }}
            />

            {/* Show header with back button on password flow */}
            <Stack.Screen
                name="ForgotPasswordRequest"
                component={ForgotPasswordRequestScreen}
                options={{
                    headerShown: true,
                    title: 'Recover your password',
                    headerTintColor: '#7B4AE2',
                    headerShadowVisible: false,
                }}
            />
            <Stack.Screen
                name="Otp"
                component={OtpScreen}
                options={{
                    headerShown: true,
                    title: 'Enter OTP',
                    headerTintColor: '#7B4AE2',
                    headerShadowVisible: false,
                }}
            />
            <Stack.Screen
                name="ResetPassword"
                component={ResetPasswordScreen}
                options={{
                    headerShown: true,
                    title: 'Create new password',
                    headerTintColor: '#7B4AE2',
                    headerShadowVisible: false,
                }}
            />
            <Stack.Screen
                name="PasswordChanged"
                component={PasswordChangedScreen}
                options={{
                    headerShown: true,
                    title: '',
                    headerTintColor: '#7B4AE2',
                    headerShadowVisible: false,
                }}
            />
        </Stack.Navigator>
    );
}
