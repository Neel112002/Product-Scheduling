// src/utils/secureStore.ts
import * as SecureStore from 'expo-secure-store';
const AT = 'access_token'; const RT = 'refresh_token';
export async function setTokens(access: string, refresh: string) {
    await SecureStore.setItemAsync(AT, access);
    await SecureStore.setItemAsync(RT, refresh);
}
export async function getAccessToken() { return SecureStore.getItemAsync(AT); }
export async function getRefreshToken() { return SecureStore.getItemAsync(RT); }
export async function clearTokens() {
    await SecureStore.deleteItemAsync(AT);
    await SecureStore.deleteItemAsync(RT);
}
