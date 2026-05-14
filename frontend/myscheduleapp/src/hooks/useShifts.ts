// src/hooks/useShifts.ts
/**
 * Hook for fetching and managing shifts via REST.
 * Use this when you need full shift data (break_minutes, notes, created_by_ai, etc.)
 * that isn't exposed via the GraphQL Shift type.
 *
 * Usage:
 *   const { shifts, loading, refetch } = useShifts({ locationId: 5, weekStart: '2024-01-15' });
 *   const { shifts: myShifts } = useMyShifts({ weekStart: '2024-01-15' });
 */
import { useCallback, useEffect, useState } from 'react';
import { ShiftsAPI } from '../api/api';

export type ShiftDetail = {
    shift_id:       number;
    location_id:    number;
    role?:          string | null;
    start_time:     string;
    end_time:       string;
    break_minutes:  number;
    notes?:         string | null;
    status:         'draft' | 'published' | 'cancelled';
    created_by_ai:  boolean;
    published_at?:  string | null;
    assignments:    { user_id: number; assigned_at: string }[];
};

type UseShiftsOptions = {
    locationId: number | null;
    weekStart?: string;
    status?:    string;
};

export function useShifts({ locationId, weekStart, status }: UseShiftsOptions) {
    const [shifts, setShifts]   = useState<ShiftDetail[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState<string | null>(null);

    const fetch = useCallback(async () => {
        if (!locationId) return;
        setLoading(true);
        setError(null);
        try {
            const { data } = await ShiftsAPI.list(locationId, weekStart, status);
            setShifts(data.shifts ?? []);
        } catch (e: any) {
            setError(e?.response?.data?.error ?? 'Failed to load shifts');
        } finally {
            setLoading(false);
        }
    }, [locationId, weekStart, status]);

    useEffect(() => { fetch(); }, [fetch]);

    return { shifts, loading, error, refetch: fetch };
}

export function useMyShifts({ weekStart }: { weekStart?: string } = {}) {
    const [shifts, setShifts]   = useState<ShiftDetail[]>([]);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await ShiftsAPI.mine(weekStart);
            setShifts(data.shifts ?? []);
        } catch {
            setShifts([]);
        } finally {
            setLoading(false);
        }
    }, [weekStart]);

    useEffect(() => { fetch(); }, [fetch]);

    return { shifts, loading, refetch: fetch };
}