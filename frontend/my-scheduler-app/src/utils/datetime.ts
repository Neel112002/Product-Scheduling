export const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${m} ${ampm}`;
};

export const getCountdown = (iso: string) => {
    const diffMs = new Date(iso).getTime() - Date.now();
    if (diffMs <= 0) return 'Now';
    const mins = Math.round(diffMs / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const fmtDayDate = (iso: string) => {
    const d = new Date(iso);
    // e.g., "Wed, Nov 12"
    return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
};