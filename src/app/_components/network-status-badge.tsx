'use client';

import { useEffect, useState } from 'react';

export function NetworkStatusBadge() {
    const [online, setOnline] = useState<boolean>(true);

    useEffect(() => {
        if (typeof navigator === 'undefined') return;
        const handleOnline = () => setOnline(true);
        const handleOffline = () => setOnline(false);
        // schedule to avoid render-in-effect warning
        const id = window.setTimeout(() => setOnline(navigator.onLine), 0);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.clearTimeout(id);
        };
    }, []);

    if (online) return null;

    return (
        <div className="fixed bottom-4 left-4 z-50 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white shadow-lg">
            Offline — changes queued
        </div>
    );
}
