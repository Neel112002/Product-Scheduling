// src/utils/biometrics.ts
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore          from 'expo-secure-store';

const TOKEN_KEY       = 'auth_token_secure';
const USER_KEY        = 'auth_user_secure';
const BIO_ENABLED_KEY = 'biometric_enabled';

// ── Device support ────────────────────────────────────────────────────────────

export async function isBiometricAvailable(): Promise<boolean> {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
}

export async function getBiometricType(): Promise<'face' | 'fingerprint' | 'none'> {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return 'face';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return 'fingerprint';
    }
    return 'none';
}

// ── Authenticate ──────────────────────────────────────────────────────────────

export async function authenticateWithBiometrics(
    promptMessage = 'Confirm your identity'
): Promise<boolean> {
    try {
        const result = await LocalAuthentication.authenticateAsync({
            promptMessage,
            cancelLabel:           'Use password instead',
            disableDeviceFallback: false,
            fallbackLabel:         'Use password',
        });
        return result.success;
    } catch {
        return false;
    }
}

// ── Secure token + user storage ───────────────────────────────────────────────

export async function storeTokenSecurely(
    token: string,
    user:  object
): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getStoredToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getStoredUser(): Promise<any | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

export async function clearStoredCredentials(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
}

export async function hasStoredSession(): Promise<boolean> {
    const token = await getStoredToken();
    return !!token;
}

// ── Biometric enabled toggle ──────────────────────────────────────────────────

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(BIO_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function isBiometricEnabled(): Promise<boolean> {
    const val = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
    return val === null ? true : val === 'true';
}