// src/validation/schemas.ts
import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export const changePasswordSchema = z.object({
    current_password: z.string().min(1),
    new_password: z.string().min(8, 'Minimum 8 characters'),
    confirm_password: z.string().min(8),
}).refine(d => d.new_password === d.confirm_password, {
    path: ['confirm_password'], message: 'Passwords must match',
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1),
    new_password: z.string().min(8),
    confirm_password: z.string().min(8),
}).refine(d => d.new_password === d.confirm_password, {
    path: ['confirm_password'], message: 'Passwords must match',
});

export const forgotSchema = z.object({
    email: z.string().email(),
});
