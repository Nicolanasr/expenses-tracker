'use client';

import { useEffect } from 'react';

import { listenForOnlineSync } from '@/lib/outbox-sync';

export function OutboxSyncListener() {
    useEffect(() => {
        const dispose = listenForOnlineSync();
        return dispose;
    }, []);
    return null;
}
