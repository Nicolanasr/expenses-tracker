'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

declare global {
    interface Window {
        workbox?: {
            addEventListener: (event: string, cb: () => void) => void;
            messageSkipWaiting: () => void;
            register: () => void;
        };
    }
}

export function SwUpdateListener() {
    const [hasUpdate, setHasUpdate] = useState(false);

    useEffect(() => {
        // next-pwa attaches workbox to window
        const wb = typeof window !== 'undefined' ? window.workbox : undefined;
        if (!wb) return;

        const onWaiting = () => setHasUpdate(true);
        wb.addEventListener('waiting', onWaiting);
        wb.register();

        return () => {
            // no cleanup API exposed; ignore
        };
    }, []);

    useEffect(() => {
        if (!hasUpdate) return;
        const id = toast(
            (t) => (
                <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">App updated</div>
                    <button
                        type="button"
                        onClick={() => {
                            toast.dismiss(t.id);
                            window.workbox?.messageSkipWaiting();
                            window.location.reload();
                        }}
                        className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                    >
                        Refresh
                    </button>
                </div>
            ),
            { duration: 8000 },
        );
        return () => toast.dismiss(id);
    }, [hasUpdate]);

    return null;
}
