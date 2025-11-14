// src/api/api.ts
import axios from 'axios';
import { API_BASE_URL } from '../config/env';
import { getAccessToken } from '../utils/secureStore';

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 10000 });

api.interceptors.request.use(async (config) => {
    const token = await getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export const AuthAPI = {
    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),
    changePassword: (body: { current_password: string; new_password: string; confirm_password: string }) =>
        api.post('/auth/change-password', body),
    forgotPassword: (email: string) =>
        api.post('/auth/forgot-password', { email }),
    resetPassword: (token: string, new_password: string, confirm_password: string) =>
        api.post('/auth/forgot-password/confirm', { token, new_password, confirm_password }),
    registerOwner: (body: any) =>
    api.post('/auth/register', body),
};
