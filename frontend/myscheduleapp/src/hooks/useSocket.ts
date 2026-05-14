// src/hooks/useSocket.ts
/**
 * WebSocket hook — connects to the Flask-SocketIO server.
 * Joins location and company rooms on connect.
 * Dispatches real-time events to registered listeners.
 *
 * Usage:
 *   const { connected } = useSocket({
 *     locationId: 5,
 *     companyId: 1,
 *     onShiftUpdated: (data) => refetchShifts(),
 *     onSchedulePublished: (data) => Alert.alert('Schedule ready!', data.message),
 *   });
 */
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { WS_URL } from '../config/env';
import { getAccessToken } from '../utils/secureStore';

type SocketOptions = {
    locationId?: number | null;
    companyId?:  number | null;
    onShiftUpdated?:       (data: any) => void;
    onShiftAssigned?:      (data: any) => void;
    onSchedulePublished?:  (data: any) => void;
    onSwapRequested?:      (data: any) => void;
    onSwapStatusChanged?:  (data: any) => void;
    onAIScheduleReady?:    (data: any) => void;
    onAIPrediction?:       (data: any) => void;
    onLaborCostUpdate?:    (data: any) => void;
    onNotification?:       (data: any) => void;
};

export function useSocket(options: SocketOptions) {
    const socketRef              = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        let socket: Socket;

        const connect = async () => {
            const token = await getAccessToken();
            if (!token) return;

            socket = io(WS_URL, {
                auth:              { token },
                transports:        ['websocket'],
                reconnection:      true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5,
            });

            socketRef.current = socket;

            socket.on('connect', () => {
                setConnected(true);

                // Join rooms based on what was passed in
                socket.emit('join', {
                    location_id: options.locationId ?? undefined,
                    company_id:  options.companyId  ?? undefined,
                });
            });

            socket.on('disconnect', () => setConnected(false));

            // ── Shift events ──────────────────────────────────────────────────
            if (options.onShiftUpdated) {
                socket.on('shift:updated', options.onShiftUpdated);
            }
            if (options.onShiftAssigned) {
                socket.on('shift:assigned', options.onShiftAssigned);
            }
            if (options.onSchedulePublished) {
                socket.on('schedule:published', options.onSchedulePublished);
            }

            // ── Swap events ───────────────────────────────────────────────────
            if (options.onSwapRequested) {
                socket.on('swap:requested', options.onSwapRequested);
            }
            if (options.onSwapStatusChanged) {
                socket.on('swap:status_changed', options.onSwapStatusChanged);
            }

            // ── AI events ─────────────────────────────────────────────────────
            if (options.onAIScheduleReady) {
                socket.on('ai:schedule_ready', options.onAIScheduleReady);
            }
            if (options.onAIPrediction) {
                socket.on('ai:prediction', options.onAIPrediction);
            }

            // ── Labor cost ────────────────────────────────────────────────────
            if (options.onLaborCostUpdate) {
                socket.on('labor:cost_update', options.onLaborCostUpdate);
            }
        };

        connect();

        return () => {
            socket?.disconnect();
            socketRef.current = null;
            setConnected(false);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options.locationId, options.companyId]);

    return { connected, socket: socketRef.current };
}