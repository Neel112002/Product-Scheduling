// src/api/api.ts
import axios from 'axios';
import { API_BASE_URL } from '../config/env';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '../utils/secureStore';

// ── Axios instance ─────────────────────────────────────────────────────────────
export const api = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });

// Attach JWT to every request
api.interceptors.request.use(async (config) => {
    const token = await getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Auto-refresh access token on 401
api.interceptors.response.use(
    (res) => res,
    async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retry) {
            original._retry = true;
            try {
                const refreshToken = await getRefreshToken();
                if (!refreshToken) throw new Error('No refresh token');
                const { data } = await axios.post(
                    `${API_BASE_URL}/auth/refresh`,
                    {},
                    { headers: { Authorization: `Bearer ${refreshToken}` } }
                );
                await setTokens(data.access_token, refreshToken);
                original.headers.Authorization = `Bearer ${data.access_token}`;
                return api(original);
            } catch {
                await clearTokens();
                return Promise.reject(error);
            }
        }
        return Promise.reject(error);
    }
);

// ── Auth API ───────────────────────────────────────────────────────────────────
export const AuthAPI = {
    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),

    me: () =>
        api.get('/auth/me'),

    registerOwner: (body: any) =>
        api.post('/auth/register', body),

    logout: () =>
        api.post('/auth/logout'),

    changePassword: (body: {
        current_password: string;
        new_password: string;
        confirm_password: string;
    }) => api.post('/auth/change-password', body),

    forgotPassword: (email: string) =>
        api.post('/auth/forgot-password', { email }),

    resetPassword: (token: string, new_password: string, confirm_password: string) =>
        api.post('/auth/forgot-password/confirm', { token, new_password, confirm_password }),

    registerPushToken: (push_token: string) =>
        api.post('/notifications/push-token', { push_token }),
};

// ── Admin API ──────────────────────────────────────────────────────────────────
export const AdminAPI = {
    listLocations: () =>
        api.get('/admin/locations'),

    listStaff: (location_id: number) =>
        api.get('/admin/staff', { params: { location_id } }),

    getCompany: () =>
        api.get('/admin/company'),

    updatePlan: (plan: 'free' | 'advanced' | 'professional') =>
        api.put('/admin/company/plan', { plan }),

    sendOnboardingInvite: (body: {
        email: string;
        location_id: number;
        position?: string;
    }) => api.post('/onboarding/invite', body),
};

// ── Shifts API ─────────────────────────────────────────────────────────────────
export const ShiftsAPI = {
    list: (location_id: number, week_start?: string, status?: string) =>
        api.get('/shifts/', { params: { location_id, week_start, status } }),

    mine: (week_start?: string) =>
        api.get('/shifts/mine', { params: { week_start } }),

    get: (shift_id: number) =>
        api.get(`/shifts/${shift_id}`),

    create: (body: {
        location_id: number;
        start_time: string;
        end_time: string;
        role_id?: number;
        break_minutes?: number;
        notes?: string;
    }) => api.post('/shifts/', body),

    update: (shift_id: number, body: Partial<{
        start_time: string;
        end_time: string;
        role_id: number;
        break_minutes: number;
        notes: string;
    }>) => api.put(`/shifts/${shift_id}`, body),

    cancel: (shift_id: number) =>
        api.delete(`/shifts/${shift_id}`),

    assign: (shift_id: number, user_id: number) =>
        api.post(`/shifts/${shift_id}/assign`, { user_id }),

    unassign: (shift_id: number, user_id: number) =>
        api.delete(`/shifts/${shift_id}/assign`, { data: { user_id } }),

    publish: (location_id: number, week_start: string) =>
        api.post('/shifts/publish', { location_id, week_start }),

    laborCost: (location_id: number, week_start: string, hourly_rate?: number) =>
        api.get('/shifts/labor-cost', { params: { location_id, week_start, hourly_rate } }),
};

// ── Swaps API ──────────────────────────────────────────────────────────────────
export const SwapsAPI = {
    request: (shift_id: number, reason?: string) =>
        api.post('/swaps/', { shift_id, reason }),

    mySwaps: () =>
        api.get('/swaps/'),

    pending: (location_id: number) =>
        api.get('/swaps/pending', { params: { location_id } }),

    accept: (swap_id: number) =>
        api.post(`/swaps/${swap_id}/accept`),

    reject: (swap_id: number) =>
        api.post(`/swaps/${swap_id}/reject`),

    approve: (swap_id: number, approve: boolean) =>
        api.post(`/swaps/${swap_id}/approve`, { approve }),
};

// ── Notifications API ──────────────────────────────────────────────────────────
export const NotificationsAPI = {
    list: (limit?: number) =>
        api.get('/notifications/', { params: { limit } }),

    markRead: (notif_id: number) =>
        api.post(`/notifications/${notif_id}/read`),

    markAllRead: () =>
        api.post('/notifications/read-all'),
};

// ── Availability API ───────────────────────────────────────────────────────────
export const AvailabilityAPI = {
    create: (body: {
        emp_id: number;
        day_of_week: string;
        start_time: string;
        end_time: string;
    }) => api.post('/availability/', body),
};

// ── AI API ─────────────────────────────────────────────────────────────────────
export const AIAPI = {
    chat: (body: {
        message: string;
        location_id: number;
        history?: { role: string; content: string }[];
    }) => api.post('/ai/chat', body),

    generateSchedule: (location_id: number, week_start: string) =>
        api.post('/ai/generate-schedule', { location_id, week_start }),

    jobStatus: (job_id: string) =>
        api.get(`/ai/job/${job_id}`),

    predictStaffing: (location_id: number, week_start: string) =>
        api.post('/ai/predict-staffing', { location_id, week_start }),

    swapRecommendations: (swap_id: number, location_id: number) =>
        api.post('/ai/swap-recommendations', { swap_id, location_id }),
};