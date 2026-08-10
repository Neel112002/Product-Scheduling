// src/hooks/usePushNotifications.ts
import { useEffect } from 'react';
import { Platform }  from 'react-native';

export function usePushNotifications() {
    useEffect(() => {
        registerForPushNotifications();
    }, []);
}

async function registerForPushNotifications() {
    try {
        // Skip in Expo Go — push notifications require a development build
        // This will automatically work when you run: npx expo run:android
        const Constants = await import('expo-constants');
        const isExpoGo  = Constants.default.executionEnvironment === 'storeClient';

        if (isExpoGo) {
            console.log('[PushNotifications] Skipped — use a dev build for push support');
            return;
        }

        const Notifications = await import('expo-notifications');

        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert:  true,
                shouldPlaySound:  true,
                shouldSetBadge:   true,
                shouldShowBanner: true,
                shouldShowList:   true,
            }),
        });

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') return;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name:             'default',
                importance:       Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor:       '#7B4AE2',
            });
        }

        const { AuthAPI } = await import('../api/api');
        const tokenData   = await Notifications.getExpoPushTokenAsync();
        await AuthAPI.registerPushToken(tokenData.data);
        console.log('[PushNotifications] Token registered successfully');

    } catch (err) {
        // Non-critical — app works without push notifications
    }
}