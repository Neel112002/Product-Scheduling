// src/context/AuthContext.tsx

import React, {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';

import { apolloClient } from '../graphql/client';
import { LOGIN_MUTATION, ME_QUERY } from '../graphql/operations';

import {
    setTokens,
    clearTokens,
    getAccessToken,
    getRefreshToken,
} from '../utils/secureStore';

// ─────────────────────────────────────────────
// Types (UPDATED FOR RBAC)
// ─────────────────────────────────────────────

export type Role = {
    id: number;
    name: string;
    isSystem: boolean;
};

export type AuthUser = {
    id: number;
    username: string;
    isActive: boolean;
    role: Role;
    primaryLocation?: { id: number; name: string } | null;
};

type LoginMutationData = {
    login: {
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
    };
};

type MeQueryData = {
    me: AuthUser;
};

type AuthContextType = {
    ready: boolean;
    isAuthenticated: boolean;
    user: AuthUser | null;

    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;

    setUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
};

// ─────────────────────────────────────────────

export const AuthContext = createContext<AuthContextType>({
    ready: false,
    isAuthenticated: false,
    user: null,
    login: async () => { },
    logout: async () => { },
    setUser: () => { },
});

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

export const AuthProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const [ready, setReady] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<AuthUser | null>(null);

    // 🔥 Proper Session Rehydration
    useEffect(() => {
        let mounted = true;

        const load = async () => {
            try {
                const [at, rt] = await Promise.all([
                    getAccessToken(),
                    getRefreshToken(),
                ]);

                if (!mounted) return;

                if (!at || !rt) {
                    setReady(true);
                    return;
                }

                const { data } = await apolloClient.query<MeQueryData>({
                    query: ME_QUERY,
                    fetchPolicy: 'network-only',
                });

                if (!mounted) return;

                if (data?.me) {
                    setUser(data.me);
                    setIsAuthenticated(true);
                } else {
                    await clearTokens();
                    setIsAuthenticated(false);
                }
            } catch (err) {
                console.log('[AuthContext] Session restore failed:', err);
                await clearTokens();
                setIsAuthenticated(false);
            } finally {
                if (mounted) setReady(true);
            }
        };

        load();

        return () => {
            mounted = false;
        };
    }, []);

    // ─────────────────────────────────────────────
    // LOGIN
    // ─────────────────────────────────────────────

    const login = useCallback(async (email: string, password: string) => {
        try {
            const { data } = await apolloClient.mutate<LoginMutationData>({
                mutation: LOGIN_MUTATION,
                variables: { email, password },
            });

            const payload = data?.login;
            if (!payload) {
                throw new Error('Login mutation returned no login payload');
            }

            await setTokens(payload.accessToken, payload.refreshToken);

            setUser(payload.user);
            setIsAuthenticated(true);
        } catch (err) {
            console.error('[AuthContext] Login error:', err);
            throw err;
        }
    }, []);

    // ─────────────────────────────────────────────
    // LOGOUT
    // ─────────────────────────────────────────────

    const logout = useCallback(async () => {
        await clearTokens();
        setIsAuthenticated(false);
        setUser(null);
        await apolloClient.clearStore();
    }, []);

    // ─────────────────────────────────────────────
    // PROVIDER VALUE
    // ─────────────────────────────────────────────

    const value = useMemo(
        () => ({
            ready,
            isAuthenticated,
            user,
            login,
            logout,
            setUser,
        }),
        [ready, isAuthenticated, user, login, logout],
    );

    if (!ready) return null;

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};