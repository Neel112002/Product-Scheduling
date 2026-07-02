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

    updateProfile: (display_name: string) =>
        api.patch('/auth/profile', { display_name }),

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

    updateLocation: (loc_id: number, body: {
        loc_name?: string;
        loc_address?: string;
        loc_lat?: number | null;
        loc_lng?: number | null;
    }) => api.put(`/admin/locations/${loc_id}`, body),

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

    getEmployeeProfile: (user_id: number) =>
        api.get(`/admin/staff/${user_id}/profile`),

    updateEmployeeProfile: (user_id: number, body: {
        hourly_rate?: number | null;
        employment_type?: 'full_time' | 'part_time' | 'casual';
        max_hours_week?: number | null;
        overtime_eligible?: boolean;
        phone?: string;
        emergency_contact?: string;
        emergency_phone?: string;
        notes?: string;
        status?: 'active' | 'inactive';
    }) => api.put(`/admin/staff/${user_id}/profile`, body),
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

    rolesWithStaff: (location_id: number) =>
        api.get('/shifts/roles-with-staff', { params: { location_id } }),

    bulkWeek: (body: {
        location_id: number;
        week_start: string;
        rows: {
            role_id: number | null;
            user_id: number;
            start_time: string;
            end_time: string;
            days: number[];
            break_minutes?: number;
        }[];
    }) => api.post('/shifts/bulk-week', body),
};

// ── Swaps API ──────────────────────────────────────────────────────────────────
export const SwapsAPI = {
    // Create
    requestOpen: (shift_id: number, reason?: string) =>
        api.post('/swaps/open', { shift_id, reason }),

    requestTargeted: (body: {
        shift_id: number;
        receiving_user_id: number;
        offered_shift_id: number;
        reason?: string;
    }) => api.post('/swaps/targeted', body),

    // Offer flow
    makeOffer: (swap_id: number, offered_shift_id: number) =>
        api.post(`/swaps/${swap_id}/offer`, { offered_shift_id }),

    retractOffer: (swap_id: number) =>
        api.post(`/swaps/${swap_id}/retract`),

    // Accept / reject / cancel
    accept: (swap_id: number) =>
        api.post(`/swaps/${swap_id}/accept`),

    reject: (swap_id: number) =>
        api.post(`/swaps/${swap_id}/reject`),

    cancel: (swap_id: number) =>
        api.post(`/swaps/${swap_id}/cancel`),

    // Lists
    mySwaps: () =>
        api.get('/swaps/mine'),

    incoming: () =>
        api.get('/swaps/incoming'),

    marketplace: (location_id?: number) =>
        api.get('/swaps/marketplace', { params: { location_id } }),

    myShiftsForOffer: () =>
        api.get('/swaps/my-shifts'),

    colleagues: () =>
        api.get('/swaps/colleagues'),

    colleagueShifts: (colleague_id: number) =>
        api.get(`/swaps/colleague-shifts/${colleague_id}`),

    // Manager
    pendingManager: (location_id: number) =>
        api.get('/swaps/pending-manager', { params: { location_id } }),

    managerDecide: (swap_id: number, approve: boolean) =>
        api.post(`/swaps/${swap_id}/decide`, { approve }),
};

// ── Drops API ──────────────────────────────────────────────────────────────────
export const DropsAPI = {
    request: (shift_id: number, reason?: string) =>
        api.post('/drops/', { shift_id, reason }),

    myDrops: () =>
        api.get('/drops/mine'),

    cancel: (drop_id: number) =>
        api.post(`/drops/${drop_id}/cancel`),

    pendingDrops: (location_id: number) =>
        api.get('/drops/pending', { params: { location_id } }),

    decide: (drop_id: number, approve: boolean) =>
        api.post(`/drops/${drop_id}/decide`, { approve }),
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
    getMine: () =>
        api.get('/availability/'),

    create: (body: {
        emp_id: number;
        day_of_week: string;
        start_time: string;
        end_time: string;
    }) => api.post('/availability/', body),

    delete: (availability_id: number) =>
        api.delete(`/availability/${availability_id}`),
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

// ── Time Entry API ─────────────────────────────────────────────────────────────
export const TimeEntryAPI = {
    getActive: () =>
        api.get('/time-entries/active'),

    getHistory: (limit = 30) =>
        api.get('/time-entries/', { params: { limit } }),

    getSettings: () =>
        api.get('/time-entries/settings'),

    getTeamStatus: (location_id: number) =>
        api.get('/time-entries/team-status', { params: { location_id } }),

    clockIn: (body: {
        shift_id?: number;
        latitude?: number;
        longitude?: number;
        pin?: string;
        notes?: string;
    }) => api.post('/time-entries/clock-in', body),

    clockOut: (notes?: string) =>
        api.post('/time-entries/clock-out', { notes }),

    startBreak: () =>
        api.post('/time-entries/break-start'),

    endBreak: () =>
        api.post('/time-entries/break-end'),

    managerClockIn: (user_id: number, shift_id?: number) =>
        api.post('/time-entries/manager/clock-in', { user_id, shift_id }),

    managerClockOut: (user_id: number) =>
        api.post('/time-entries/manager/clock-out', { user_id }),

    updateSettings: (body: {
        clock_in_method?: string;
        break_duration_mins?: number;
        max_breaks_per_shift?: number | null;
        paid_break?: boolean;
        gps_radius_meters?: number;
    }) => api.put('/time-entries/settings', body),

    generatePin: () =>
        api.post('/time-entries/settings/generate-pin'),
};

// ── Analytics API ──────────────────────────────────────────────────────────────
export const AnalyticsAPI = {
    get: (location_id: number, period: 'day' | 'week' | 'month', start_date?: string) =>
        api.get('/admin/analytics/', {
            params: { location_id, period, start_date },
        }),
};

// ── Time Off API ───────────────────────────────────────────────────────────────
export const TimeOffAPI = {
    create: (body: {
        start_date: string;
        end_date: string;
        request_type: 'vacation' | 'sick' | 'personal' | 'other';
        reason?: string;
    }) => api.post('/time-off/', body),

    myRequests: () =>
        api.get('/time-off/mine'),

    cancel: (request_id: number) =>
        api.post(`/time-off/${request_id}/cancel`),

    pending: () =>
        api.get('/time-off/pending'),

    decide: (request_id: number, approve: boolean, manager_notes?: string) =>
        api.post(`/time-off/${request_id}/decide`, { approve, manager_notes }),
};