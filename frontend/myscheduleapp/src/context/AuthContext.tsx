// src/context/AuthContext.tsx
import React, {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { apolloClient } from '../graphql/client';
import { ME_QUERY }     from '../graphql/operations';
import {
    setTokens,
    clearTokens,
    getAccessToken,
    getRefreshToken,
} from '../utils/secureStore';
import {
    storeTokenSecurely,
    clearStoredCredentials,
    isBiometricAvailable,
    isBiometricEnabled,
} from '../utils/biometrics';
import { AuthAPI } from '../api/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Role = {
    id:       number;
    name:     string;
    isSystem: boolean;
};

export type AuthUser = {
    id:               number;
    username:         string;
    display_name?:    string | null;
    user_email?:      string;
    isActive:         boolean;
    role:             Role;
    primaryLocation?: { id: number; name: string } | null;
};

type AuthContextType = {
    ready:           boolean;
    isAuthenticated: boolean;
    user:            AuthUser | null;
    login:           (email: string, password: string) => Promise<void>;
    logout:          () => Promise<void>;
    restoreSession:  (token: string, user: AuthUser) => void;
    setUser:         React.Dispatch<React.SetStateAction<AuthUser | null>>;
};

// ── Context ───────────────────────────────────────────────────────────────────

export const AuthContext = createContext<AuthContextType>({
    ready:           false,
    isAuthenticated: false,
    user:            null,
    login:           async () => {},
    logout:          async () => {},
    restoreSession:  () => {},
    setUser:         () => {},
});

// ── Helper ────────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), ms)
        ),
    ]);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [ready,           setReady]           = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user,            setUser]            = useState<AuthUser | null>(null);
    const mountedRef                            = useRef(true);

    // ── Boot — restore session ────────────────────────────────────────────────
    useEffect(() => {
        mountedRef.current = true;

        const bootSession = async () => {
            try {
                const [at, rt] = await Promise.all([
                    getAccessToken(),
                    getRefreshToken(),
                ]);

                if (!mountedRef.current) return;

                // No tokens — show login
                if (!at || !rt) {
                    setReady(true);
                    return;
                }

                // ✅ Check if biometrics available AND enabled by user
                const bioAvailable = await isBiometricAvailable();
                const bioEnabled   = await isBiometricEnabled();

                if (bioAvailable && bioEnabled) {
                    // Require biometric gate — show LoginScreen
                    // LoginScreen auto-prompts biometric on mount
                    if (mountedRef.current) setReady(true);
                    return;
                }

                // No biometrics / disabled — auto-restore session silently

                // Try GraphQL first (8s timeout)
                try {
                    const result = await withTimeout(
                        apolloClient.query<{ me: AuthUser }>({
                            query:       ME_QUERY,
                            fetchPolicy: 'network-only',
                        }),
                        8000
                    );

                    if (!mountedRef.current) return;

                    if (result.data?.me) {
                        setUser(result.data.me as AuthUser);
                        setIsAuthenticated(true);
                        setReady(true);
                        return;
                    }
                } catch (gqlErr) {
                    console.log('[AuthContext] GraphQL restore failed, trying REST:', gqlErr);
                }

                if (!mountedRef.current) return;

                // Fallback REST (5s timeout)
                try {
                    const { data: meData } = await withTimeout(AuthAPI.me(), 5000);

                    if (!mountedRef.current) return;

                    if (meData?.user_id) {
                        setUser(_buildUser(meData));
                        setIsAuthenticated(true);
                        setReady(true);
                        return;
                    }
                } catch (restErr) {
                    console.log('[AuthContext] REST restore failed:', restErr);
                }

                // Both failed — clear and show login
                await clearTokens();
                await clearStoredCredentials();
                if (mountedRef.current) {
                    setIsAuthenticated(false);
                    setReady(true);
                }

            } catch (err) {
                console.log('[AuthContext] Unexpected error:', err);
                await clearTokens();
                await clearStoredCredentials();
                if (mountedRef.current) {
                    setIsAuthenticated(false);
                    setReady(true);
                }
            }
        };

        bootSession();
        return () => { mountedRef.current = false; };
    }, []);

    // ── Login ─────────────────────────────────────────────────────────────────
    const login = useCallback(async (email: string, password: string) => {
        const { data } = await AuthAPI.login(email.trim().toLowerCase(), password);

        if (!data?.access_token) {
            throw new Error(data?.error ?? 'Login failed — no token returned');
        }

        await setTokens(data.access_token, data.refresh_token);

        const loggedInUser = _buildUser(data.user);

        // Store user + token securely for biometric access
        await storeTokenSecurely(data.access_token, loggedInUser);

        setUser(loggedInUser);
        setIsAuthenticated(true);
    }, []);

    // ── Restore session — called after biometric success ──────────────────────
    const restoreSession = useCallback((token: string, restoredUser: AuthUser) => {
        setUser(restoredUser);
        setIsAuthenticated(true);
    }, []);

    // ── Logout ────────────────────────────────────────────────────────────────
    const logout = useCallback(async () => {
        try { await AuthAPI.logout(); } catch { /* ignore */ }
        await clearTokens();
        await clearStoredCredentials();
        setIsAuthenticated(false);
        setUser(null);
        try { await apolloClient.clearStore(); } catch { /* ignore */ }
    }, []);

    const value = useMemo(
        () => ({ ready, isAuthenticated, user, login, logout, restoreSession, setUser }),
        [ready, isAuthenticated, user, login, logout, restoreSession],
    );

    if (!ready) return null;

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// ── Helper ────────────────────────────────────────────────────────────────────

function _buildUser(u: any): AuthUser {
    return {
        id:           u.user_id      ?? u.id ?? 0,
        username:     u.username     ?? '',
        display_name: u.display_name ?? null,
        user_email:   u.user_email   ?? '',
        isActive:     true,
        role: {
            id:       0,
            name:     u.role         ?? 'staff',
            isSystem: false,
        },
        primaryLocation: u.location_id
            ? { id: u.location_id, name: '' }
            : null,
    };
}