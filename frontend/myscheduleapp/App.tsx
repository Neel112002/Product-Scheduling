// App.tsx
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider }     from './src/context/AuthContext';
import RootNavigator        from './src/navigation/RootNavigator';
import { usePushNotifications } from './src/hooks/usePushNotifications';

// Inner component so hooks run inside AuthProvider context
function AppInner() {
    usePushNotifications();   // registers Expo push token after login
    return <RootNavigator />;
}

export default function App() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <AppInner />
            </AuthProvider>
        </SafeAreaProvider>
    );
}