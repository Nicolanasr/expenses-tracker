import { openDB, type DBSchema } from 'idb';

type TransactionCacheFilters = {
  start: string;
  end: string;
  sort?: string;
  categoryIds?: string[];
  paymentMethod?: string;
  accountId?: string;
};

type TransactionCacheEntry = {
  id: string;
  filters: TransactionCacheFilters;
  data: unknown;
  updatedAt: number;
};

type BudgetCacheEntry = {
  id: string;
  month: string;
  data: unknown;
  updatedAt: number;
};

type QueueEntry = {
  id: string;
  type:
    | 'transaction:create'
    | 'transaction:update'
    | 'transaction:delete'
    | 'category:create'
    | 'category:update'
    | 'category:delete'
    | 'budget:save';
  payload: Record<string, unknown>;
  status: 'pending' | 'failed';
  createdAt: number;
  lastError?: string;
};

interface OfflineDB extends DBSchema {
  transactions: {
    key: string;
    value: TransactionCacheEntry;
  };
  budgets: {
    key: string;
    value: BudgetCacheEntry;
  };
  outbox: {
    key: string;
    value: QueueEntry;
    indexes: { status: string };
  };
}

const DB_NAME = 'expenseo-offline';
const DB_VERSION = 2; // bump to ensure outbox store exists for existing users

async function getDB() {
  return openDB<OfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('transactions')) {
        db.createObjectStore('transactions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('budgets')) {
        db.createObjectStore('budgets', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('outbox')) {
        const store = db.createObjectStore('outbox', { keyPath: 'id' });
        store.createIndex('status', 'status');
      }
    },
  });
}

const hashFilters = (filters: TransactionCacheFilters) => {
  return JSON.stringify({
    ...filters,
    categoryIds: (filters.categoryIds ?? []).slice().sort(),
  });
};

export async function cacheTransactions(filters: TransactionCacheFilters, data: unknown) {
  try {
    const db = await getDB();
    const id = hashFilters(filters);
    const entry: TransactionCacheEntry = {
      id,
      filters,
      data,
      updatedAt: Date.now(),
    };
    await db.put('transactions', entry);
  } catch (error) {
    console.error('[offline-cache] unable to cache transactions', error);
  }
}

export async function readCachedTransactions(filters: TransactionCacheFilters) {
  try {
    const db = await getDB();
    const id = hashFilters(filters);
    const entry = await db.get('transactions', id);
    return entry?.data ?? null;
  } catch (error) {
    console.error('[offline-cache] unable to read cached transactions', error);
    return null;
  }
}

export async function removeTransactionFromCache(transactionId: string) {
  try {
    const db = await getDB();
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    const all = await store.getAll();
    const updates = all.map(async (entry) => {
      if (!entry?.data || typeof entry.data !== 'object') return;
      const data = entry.data as { transactions?: Array<{ id?: string }> };
      if (!Array.isArray(data.transactions)) return;
      const next = data.transactions.filter((row) => row?.id !== transactionId);
      if (next.length !== data.transactions.length) {
        await store.put({ ...entry, data: { ...data, transactions: next } });
      }
    });
    await Promise.all(updates);
    await tx.done;
  } catch (error) {
    console.error('[offline-cache] unable to remove transaction from cache', error);
  }
}

export async function cacheBudgets(month: string, data: unknown) {
  try {
    const db = await getDB();
    const entry: BudgetCacheEntry = {
      id: month,
      month,
      data,
      updatedAt: Date.now(),
    };
    await db.put('budgets', entry);
  } catch (error) {
    console.error('[offline-cache] unable to cache budgets', error);
  }
}

export async function readCachedBudgets(month: string) {
  try {
    const db = await getDB();
    const entry = await db.get('budgets', month);
    return entry?.data ?? null;
  } catch (error) {
    console.error('[offline-cache] unable to read cached budgets', error);
    return null;
  }
}

export async function enqueueMutation(entry: {
  type: QueueEntry['type'];
  payload: Record<string, unknown>;
}) {
  try {
    const db = await getDB();
    const record: QueueEntry = {
      id: crypto.randomUUID(),
      type: entry.type,
      payload: entry.payload,
      status: 'pending',
      createdAt: Date.now(),
    };
    await db.put('outbox', record);
    return record.id;
  } catch (error) {
    console.error('[offline-cache] unable to enqueue', error);
    return null;
  }
}

export async function consumeOutbox() {
  const db = await getDB();
  const tx = db.transaction('outbox', 'readonly');
  const store = tx.objectStore('outbox');
  const index = store.index('status');
  return index.getAll('pending');
}

export async function clearOutboxEntry(id: string) {
  try {
    const db = await getDB();
    await db.delete('outbox', id);
  } catch (error) {
    console.error('[offline-cache] unable to clear outbox entry', error);
  }
}

export async function markOutboxFailed(id: string, message: string) {
  try {
    const db = await getDB();
    const existing = await db.get('outbox', id);
    if (!existing) return;
    await db.put('outbox', { ...existing, status: 'failed', lastError: message });
  } catch (error) {
    console.error('[offline-cache] unable to mark outbox failed', error);
  }
}

export async function removeQueuedCreateForTempId(tempId: string) {
  try {
    const db = await getDB();
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    const all = await store.getAll();
    const toDelete = all.filter(
      (entry) => entry.type === 'transaction:create' && (entry.payload as { id?: string })?.id === tempId,
    );
    await Promise.all(toDelete.map((entry) => store.delete(entry.id)));
    await tx.done;
  } catch (error) {
    console.error('[offline-cache] unable to drop temp create', error);
  }
}
