'use client';

import {
  enqueueMutation,
  consumeOutbox,
  markOutboxFailed,
  clearOutboxEntry,
  removeQueuedCreateForTempId,
  removeTransactionFromCache,
} from '@/lib/cache';
import toast from 'react-hot-toast';

type TransactionMutation =
  | { type: 'create'; data: Record<string, unknown> }
  | { type: 'update'; data: Record<string, unknown> }
  | { type: 'delete'; data: { id: string; updated_at?: string } };

type CategoryMutation =
  | { type: 'create'; data: Record<string, unknown> }
  | { type: 'update'; data: Record<string, unknown> }
  | { type: 'delete'; data: { id: string; updated_at?: string } };

type BudgetMutation = { month: string; items: Array<{ categoryId: string; amount: number }> };

async function queue(type: Parameters<typeof enqueueMutation>[0]['type'], data: Record<string, unknown>) {
  // For offline UI hints, emit an event with the queued payload
  const payload = { ...data };
  if (type === 'transaction:create' && !payload.id) {
    const tempId = `temp-${crypto.randomUUID()}`;
    payload.id = tempId;
    data.id = tempId;
  }
  if (type === 'transaction:delete' && payload.id && payload.id.toString().startsWith('temp-')) {
    // This deletes the locally created temp transaction before it ever reaches server
    await removeQueuedCreateForTempId(payload.id as string);
    await removeTransactionFromCache(payload.id as string);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('outbox:queued', {
          detail: { type, payload },
        }),
      );
    }
    toast.success('Removed unsynced transaction');
    return;
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('outbox:queued', {
        detail: { type, payload },
      }),
    );
  }

  const id = await enqueueMutation({ type, payload: data });
  if (id) {
    toast.success('Queued offline — will sync when online');
  }
}

export async function queueTransactionMutation(mutation: TransactionMutation) {
  return queue(`transaction:${mutation.type}` as const, mutation.data);
}

export async function queueCategoryMutation(mutation: CategoryMutation) {
  return queue(`category:${mutation.type}` as const, mutation.data);
}

export async function queueBudgetMutation(mutation: BudgetMutation) {
  return queue('budget:save', mutation as Record<string, unknown>);
}

export async function syncOutbox() {
  const entries = await consumeOutbox();
  const isTempId = (val: unknown) => typeof val === 'string' && val.startsWith('temp-');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('outbox:sync-state', { detail: { state: 'syncing', total: entries.length, current: 0 } }),
    );
  }

  let current = 0;
  for (const entry of entries) {
    // Skip temp ids for delete/update (e.g., deleting an offline-created item that never hit server)
    if (
      (entry.type === 'transaction:delete' || entry.type === 'transaction:update') &&
      isTempId((entry.payload as { id?: unknown }).id)
    ) {
      const tempId = (entry.payload as { id?: unknown }).id as string | undefined;
      if (tempId) {
        await removeQueuedCreateForTempId(tempId);
        await removeTransactionFromCache(tempId);
      }
      await clearOutboxEntry(entry.id);
      current += 1;
      continue;
    }

    // Strip temp id before syncing creates; server will assign real IDs
    if (entry.type === 'transaction:create' && isTempId((entry.payload as { id?: unknown }).id)) {
      delete (entry.payload as { id?: unknown }).id;
    }

    try {
      const res = await fetch('/api/transactions/mutate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: entry.type,
          data: entry.payload,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(async () => {
          const text = await res.text().catch(() => '');
          return text ? { error: text } : null;
        });
        throw new Error(payload?.error || `Sync failed (${res.status})`);
      }
      await clearOutboxEntry(entry.id);
      current += 1;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('outbox:sync-state', { detail: { state: 'syncing', total: entries.length, current } }),
        );
      }
      toast.success('Synced offline change');
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Sync failed';
      await markOutboxFailed(entry.id, reason);
      toast.error(`Offline change needs attention: ${reason}`);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('outbox:sync-state', { detail: { state: 'idle', total: entries.length, current } }),
    );
  }
}

export function listenForOnlineSync() {
  if (typeof window === 'undefined') return;
  const handler = () => {
    syncOutbox().catch(() => {
      /* silent */
    });
  };
  window.addEventListener('online', handler);
  handler();
  return () => window.removeEventListener('online', handler);
}
