// src/context/AuthContext.tsx
import React, {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';

import { apolloClient } from '../graphql/client';
import { LOGIN_MUTATION } from '../graphql/operations';

import {
    setTokens,
    clearTokens,
    getAccessToken,
    getRefreshToken,
} from '../utils/secureStore';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export type AuthUser = {
    user_id: number;
    username: string;
    user_email: string;
    display_name?: string | null;
    role?: string | null;
    company?: { id: number; name: string } | null;
    primaryLocation?: { id: number; name: string } | null;
};

type LoginMutationData = {
    login: {
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
    };
};

type AuthContextType = {
    ready: boolean;
    isAuthenticated: boolean;
    user: AuthUser | null;
    role: string | null;

    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;

    // ✅ expose setter so screens (e.g. CompleteProfile) can update user
    setUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
};

export const AuthContext = createContext<AuthContextType>({
    ready: false,
    isAuthenticated: false,
    user: null,
    role: null,
    login: async () => {},
    logout: async () => {},
    setUser: () => {},
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
    const [role, setRole] = useState<string | null>(null);

    // Hydrate tokens on startup
    useEffect(() => {
        let mounted = true;

        const load = async () => {
            const [at, rt] = await Promise.all([
                getAccessToken(),
                getRefreshToken(),
            ]);

            if (!mounted) return;

            if (at && rt) {
                setIsAuthenticated(true);
            }

            setReady(true);
        };

        load();
        return () => {
            mounted = false;
        };
    }, []);

    // ─────────────────────────────────────────────
    // LOGIN (GraphQL)
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

            // Save tokens
            await setTokens(payload.accessToken, payload.refreshToken);

            // Save user + role
            setUser(payload.user);
            setRole(payload.user.role ?? null);

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
        setRole(null);
    }, []);

    // ─────────────────────────────────────────────
    // PROVIDER VALUE
    // ─────────────────────────────────────────────
    const value = useMemo(
        () => ({
            ready,
            isAuthenticated,
            user,
            role,
            login,
            logout,
            setUser, // ✅ exposed here
        }),
        [ready, isAuthenticated, user, role, login, logout],
    );

    if (!ready) return null;

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
