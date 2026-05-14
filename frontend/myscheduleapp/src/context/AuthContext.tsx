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
import { ME_QUERY } from '../graphql/operations';
import {
    setTokens,
    clearTokens,
    getAccessToken,
    getRefreshToken,
} from '../utils/secureStore';
import { AuthAPI } from '../api/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Role = {
    id: number;
    name: string;
    isSystem: boolean;
};

export type AuthUser = {
    id: number;
    username: string;
    display_name?: string | null;
    user_email?: string;
    isActive: boolean;
    role: Role;
    primaryLocation?: { id: number; name: string } | null;
};

type AuthContextType = {
    ready: boolean;
    isAuthenticated: boolean;
    user: AuthUser | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    setUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
};

// ── Context ───────────────────────────────────────────────────────────────────

export const AuthContext = createContext<AuthContextType>({
    ready: false,
    isAuthenticated: false,
    user: null,
    login: async () => {},
    logout: async () => {},
    setUser: () => {},
});

// ── Helper: promise with timeout ──────────────────────────────────────────────

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
    const [ready, setReady]                     = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser]                       = useState<AuthUser | null>(null);
    const mountedRef                            = useRef(true);

    useEffect(() => {
        mountedRef.current = true;

        const restoreSession = async () => {
            try {
                const [at, rt] = await Promise.all([
                    getAccessToken(),
                    getRefreshToken(),
                ]);

                if (!mountedRef.current) return;

                // No tokens stored — show login screen immediately
                if (!at || !rt) {
                    setReady(true);
                    return;
                }

                // Try GraphQL first (8 second timeout)
                try {
                    const { data } = await withTimeout(
                        apolloClient.query({ query: ME_QUERY, fetchPolicy: 'network-only' }),
                        8000
                    );

                    if (!mountedRef.current) return;

                    if (data?.me) {
                        setUser(data.me as AuthUser);
                        setIsAuthenticated(true);
                        setReady(true);
                        return;
                    }
                } catch (gqlErr) {
                    console.log('[AuthContext] GraphQL session restore failed, trying REST:', gqlErr);
                }

                if (!mountedRef.current) return;

                // Fallback: REST /auth/me (5 second timeout)
                try {
                    const { data: meData } = await withTimeout(
                        AuthAPI.me(),
                        5000
                    );

                    if (!mountedRef.current) return;

                    if (meData?.user_id) {
                        setUser({
                            id:           meData.user_id,
                            username:     meData.username    ?? '',
                            display_name: meData.display_name ?? null,
                            user_email:   meData.user_email   ?? '',
                            isActive:     true,
                            role: {
                                id:       0,
                                name:     meData.role     ?? 'staff',
                                isSystem: false,
                            },
                            primaryLocation: meData.location_id
                                ? { id: meData.location_id, name: '' }
                                : null,
                        });
                        setIsAuthenticated(true);
                        setReady(true);
                        return;
                    }
                } catch (restErr) {
                    console.log('[AuthContext] REST session restore failed:', restErr);
                }

                // Both failed — clear tokens and show login
                await clearTokens();
                if (mountedRef.current) {
                    setIsAuthenticated(false);
                    setReady(true);
                }

            } catch (err) {
                console.log('[AuthContext] Unexpected error:', err);
                await clearTokens();
                if (mountedRef.current) {
                    setIsAuthenticated(false);
                    setReady(true);
                }
            }
        };

        restoreSession();

        return () => {
            mountedRef.current = false;
        };
    }, []);

    // ── Login via REST ────────────────────────────────────────────────────────
    const login = useCallback(async (email: string, password: string) => {
        const { data } = await AuthAPI.login(email.trim().toLowerCase(), password);

        if (!data?.access_token) {
            throw new Error(data?.error ?? 'Login failed — no token returned');
        }

        await setTokens(data.access_token, data.refresh_token);

        // Build user from REST response (no GraphQL needed at login time)
        const u = data.user;
        setUser({
            id:           u.user_id,
            username:     u.username     ?? '',
            display_name: u.display_name ?? null,
            user_email:   u.user_email   ?? '',
            isActive:     true,
            role: {
                id:       0,
                name:     u.role ?? 'staff',
                isSystem: false,
            },
            primaryLocation: u.location_id
                ? { id: u.location_id, name: '' }
                : null,
        });
        setIsAuthenticated(true);
    }, []);

    // ── Logout ────────────────────────────────────────────────────────────────
    const logout = useCallback(async () => {
        try { await AuthAPI.logout(); } catch { /* ignore */ }
        await clearTokens();
        setIsAuthenticated(false);
        setUser(null);
        try { await apolloClient.clearStore(); } catch { /* ignore */ }
    }, []);

    const value = useMemo(
        () => ({ ready, isAuthenticated, user, login, logout, setUser }),
        [ready, isAuthenticated, user, login, logout],
    );

    // Show nothing while restoring session (very brief — max 8s then always resolves)
    if (!ready) return null;

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};