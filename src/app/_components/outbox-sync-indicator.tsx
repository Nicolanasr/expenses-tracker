'use client';

import { useEffect, useState } from 'react';

type SyncState = {
    state: 'idle' | 'syncing';
    total?: number;
    current?: number;
};

export function OutboxSyncIndicator() {
    const [sync, setSync] = useState<SyncState>({ state: 'idle', total: 0, current: 0 });

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<SyncState>).detail;
            if (!detail) return;
            setSync(detail);
        };
        window.addEventListener('outbox:sync-state', handler);
        return () => window.removeEventListener('outbox:sync-state', handler);
    }, []);

    if (sync.state !== 'syncing') return null;
    const total = sync.total ?? 0;
    const current = Math.min(sync.current ?? 0, total);
    const label = total > 0 ? `Syncing changes… ${current}/${total}` : 'Syncing changes…';

    return (
        <div className="fixed bottom-16 right-4 z-50 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-lg">
            {label}
        </div>
    );
}
