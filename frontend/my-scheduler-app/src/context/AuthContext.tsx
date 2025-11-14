import React, {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { Alert } from 'react-native';
import { AuthAPI } from '../api/api';
import {
    setTokens,
    clearTokens,
    getAccessToken,
    getRefreshToken,
} from '../utils/secureStore';
import { z } from 'zod';
import {
    changePasswordSchema,
    resetPasswordSchema,
} from '../validation/schemas';

export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;

// Shape of the user object coming back from backend
export type AuthUser = {
    user_id: number;
    username: string;
    user_email: string;
    display_name?: string | null;
    role?: 'owner' | 'manager' | 'employee' | string | null;
    company_id?: number | null;
    location_id?: number | null;
    is_verified?: boolean;
};

type AuthContextType = {
    /** true when we finished hydrating tokens from storage */
    ready: boolean;
    /** true when user has both access & refresh tokens */
    isAuthenticated: boolean;

    /** full user object from backend (/auth/login -> data.user) */
    user: AuthUser | null;

    /** normalized role for RBAC */
    role: 'owner' | 'manager' | 'employee' | null;
    isManagerOrOwner: boolean;

    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    changePassword: (body: ChangePasswordBody) => Promise<void>;
    forgotPassword: (email: string) => Promise<void>;
    resetPassword: (body: ResetPasswordBody) => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [ready, setReady] = useState(false);
    const [authed, setAuthed] = useState(false);
    const [user, setUser] = useState<AuthUser | null>(null);
    const [role, setRole] = useState<'owner' | 'manager' | 'employee' | null>(null);

    // Hydrate tokens on app start
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const [at, rt] = await Promise.all([
                    getAccessToken(),
                    getRefreshToken(),
                ]);
                if (!mounted) return;

                // If you want to fully hydrate `user`/`role` on cold start,
                // you can call a /auth/me endpoint here and setUser/setRole.
                setAuthed(Boolean(at && rt));
            } finally {
                if (mounted) setReady(true);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const { data } = await AuthAPI.login(email, password);
        console.log('[Auth] /auth/login response:', data);

        const access =
            data?.access_token ??
            data?.access ??
            data?.token ??
            data?.tokens?.access ??
            data?.data?.access_token;
        const refresh =
            data?.refresh_token ??
            data?.refresh ??
            data?.tokens?.refresh ??
            data?.data?.refresh_token;

        if (!access || !refresh) {
            const keys = data ? Object.keys(data).join(', ') : 'no data';
            throw new Error(
                `Backend did not return tokens in expected shape. Got keys: ${keys}`,
            );
        }

        // User object from backend
        const backendUser: AuthUser | null = (data.user as AuthUser) ?? null;
        const rawRole = (backendUser?.role as string | undefined) ?? null;

        // Normalize role
        let normalizedRole: 'owner' | 'manager' | 'employee' | null = null;
        if (rawRole) {
            const lower = rawRole.toLowerCase();
            if (lower === 'owner') normalizedRole = 'owner';
            else if (lower === 'manager') normalizedRole = 'manager';
            else normalizedRole = 'employee';
        }

        // Block login if we have no role
        if (!normalizedRole) {
            Alert.alert(
                'Account Error',
                'Your account is not configured with a role.',
            );
            // make sure we don't keep any tokens
            await clearTokens();
            setAuthed(false);
            setUser(null);
            setRole(null);
            throw new Error('User has no role – blocking login.');
        }

        await setTokens(access, refresh);
        setUser(backendUser);
        setRole(normalizedRole);
        setAuthed(true); // RootNavigator will switch to App/Admin stack
    }, []);

    const logout = useCallback(async () => {
        await clearTokens();
        setAuthed(false);
        setUser(null);
        setRole(null);
    }, []);

    const changePassword = useCallback(
        async (body: ChangePasswordBody) => {
            await AuthAPI.changePassword(body);
            await logout(); // force re-auth per your requirements
        },
        [logout],
    );

    const forgotPassword = useCallback(async (email: string) => {
        await AuthAPI.forgotPassword(email);
    }, []);

    const resetPassword = useCallback(
        async (body: ResetPasswordBody) => {
            await AuthAPI.resetPassword(
                body.token,
                body.new_password,
                body.confirm_password,
            );
            await logout();
        },
        [logout],
    );

    const value = useMemo(
        () => ({
            ready,
            isAuthenticated: authed,
            user,
            role,
            isManagerOrOwner: role === 'owner' || role === 'manager',
            login,
            logout,
            changePassword,
            forgotPassword,
            resetPassword,
        }),
        [
            ready,
            authed,
            user,
            role,
            login,
            logout,
            changePassword,
            forgotPassword,
            resetPassword,
        ],
    );

    if (!ready) return null; // or splash screen

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
