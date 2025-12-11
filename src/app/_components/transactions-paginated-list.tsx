'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { TransactionItem } from '@/app/_components/transaction-item';
import { cacheTransactions, readCachedTransactions } from '@/lib/cache';
import { normalizePaymentMethod, type PaymentMethod } from '@/lib/payment-methods';
import { bulkDeleteTransactions, bulkUpdateTransactionCategory } from '@/app/actions';

const PAGE_OPTIONS = [7, 14, 28, 56, 112];

export type Transaction = {
    id: string;
    amount: number;
    type: 'income' | 'expense';
    currencyCode: string;
    occurredOn: string;
    paymentMethod: PaymentMethod;
    notes: string | null;
    payee: string | null;
    updatedAt: string;
    categoryId: string | null;
    category: {
        id: string;
        name: string;
        icon: string | null;
        color: string | null;
        type: 'income' | 'expense';
    } | null;
    accountId: string | null;
    account: {
        id: string;
        name: string;
        type: string;
        institution: string | null;
        defaultPaymentMethod?: 'cash' | 'card' | 'transfer' | 'bank_transfer' | 'account_transfer' | 'other' | null;
    } | null;
};

export type CategoryOption = {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    type: 'income' | 'expense';
};

export type AccountOption = {
    id: string;
    name: string;
    type: string;
    institution: string | null;
    defaultPaymentMethod?: 'cash' | 'card' | 'transfer' | 'bank_transfer' | 'account_transfer' | 'other' | null;
};

export type TransactionFilters = {
    start: string;
    end: string;
    categoryIds?: string[];
    paymentMethod?: string;
    search?: string;
    type?: string;
    sort?: string;
    minAmount?: number;
    maxAmount?: number;
    accountId?: string;
};

type Props = {
    initialTransactions: Transaction[];
    totalCount: number;
    pageSize: number;
    page: number;
    filters: TransactionFilters;
    categories: CategoryOption[];
    accounts: AccountOption[];
    payees?: string[];
    allowEditing?: boolean;
    preferCacheOnMount?: boolean;
    renderFilters?: React.ReactNode;
    title?: string;
    emptyMessage?: string;
};

export function TransactionsPaginatedList({
    initialTransactions,
    totalCount,
    pageSize,
    page,
    filters,
    categories,
    accounts,
    payees = [],
    allowEditing = false,
    preferCacheOnMount = false,
    renderFilters,
    title = 'Filtered transactions',
    emptyMessage = 'Nothing here yet. Adjust filters or add a transaction above.',
}: Props) {
    const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
    const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);

    const normalizeRows = useMemo(
        () =>
            (list: Partial<Transaction>[]) =>
                (list ?? []).map((tx) => ({
                    ...tx,
                    paymentMethod: normalizePaymentMethod(tx.paymentMethod ?? 'other'),
                    updatedAt: tx.updatedAt ?? tx.occurredOn ?? new Date().toISOString(),
                    category:
                        tx.categoryId && !tx.category
                            ? (categoryMap.get(tx.categoryId) as Transaction['category']) ?? null
                            : (tx.category as Transaction['category']) ?? null,
                    account:
                        tx.accountId && !tx.account
                            ? (accountMap.get(tx.accountId) as Transaction['account']) ?? null
                            : (tx.account as Transaction['account']) ?? null,
                    payee: tx.payee ?? null,
                })) as Transaction[],
        [categoryMap, accountMap],
    );

    const [rows, setRows] = useState<Transaction[]>(normalizeRows(initialTransactions));
    const [total, setTotal] = useState(totalCount);
    const [currentPage, setCurrentPage] = useState(page);
    const [currentPageSize, setCurrentPageSize] = useState(pageSize);
    const [isPending, startTransition] = useTransition();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkCategoryId, setBulkCategoryId] = useState<string>('');
    const [isBulkPending, setIsBulkPending] = useState(false);
    const [showBulkConfirm, setShowBulkConfirm] = useState(false);

    useEffect(() => {
        const normalized = normalizeRows(initialTransactions);
        setRows(normalized);
        setTotal(totalCount);
        setCurrentPage(page);
        setCurrentPageSize(pageSize);
        setErrorMessage(null);
        setSelectedIds(new Set());
        cacheTransactions(filters, { transactions: normalized, total: totalCount }).catch(() => { });
    }, [initialTransactions, totalCount, page, pageSize, filters, normalizeRows]);

    useEffect(() => {
        if (!preferCacheOnMount) return;
        if (typeof navigator !== 'undefined' && navigator.onLine) return;
        readCachedTransactions(filters).then((cached) => {
            const cachedData = cached as { transactions?: Transaction[]; total?: number } | null;
            if (cachedData?.transactions?.length) {
                const normalized = normalizeRows(cachedData.transactions);
                setRows(normalized);
                setTotal(cachedData.total ?? normalized.length);
            }
        });
    }, [preferCacheOnMount, filters, normalizeRows]);

    // Optimistically update list when we queue offline mutations
    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<{ type: string; payload: Record<string, unknown> }>).detail;
            if (!detail?.type?.startsWith('transaction:')) return;
            const payload = detail.payload;
            setRows((prev) => {
                switch (detail.type) {
                    case 'transaction:create': {
                        const id = (payload.id as string) || `temp-${Date.now()}`;
                        const categoryId = (payload.category_id as string | null | undefined) ?? null;
                        const accountId = (payload.account_id as string | null | undefined) ?? null;
                        const newRow: Transaction = {
                            id,
                            amount: Number(payload.amount ?? 0),
                            type: (payload.type as Transaction['type']) ?? 'expense',
                            currencyCode: 'USD',
                            occurredOn: (payload.occurred_on as string) ?? new Date().toISOString().slice(0, 10),
                            paymentMethod: normalizePaymentMethod((payload.payment_method as string) ?? 'other'),
                            notes: (payload.notes as string) ?? null,
                            payee: (payload.payee as string | null | undefined) ?? null,
                            categoryId,
                            category:
                                categoryId && categoryMap.has(categoryId)
                                    ? (categoryMap.get(categoryId) as Transaction['category'])
                                    : null,
                            accountId,
                            account:
                                accountId && accountMap.has(accountId)
                                    ? (accountMap.get(accountId) as Transaction['account'])
                                    : null,
                            updatedAt: new Date().toISOString(),
                        };
                        setTotal((t) => t + 1);
                        return [newRow, ...prev];
                    }
                    case 'transaction:update': {
                        const id = payload.id as string | undefined;
                        if (!id) return prev;
                        return prev.map((row) =>
                            row.id === id
                                ? {
                                    ...row,
                                    amount: payload.amount !== undefined ? Number(payload.amount) : row.amount,
                                    occurredOn: (payload.occurred_on as string) ?? row.occurredOn,
                                    paymentMethod: payload.payment_method ? normalizePaymentMethod(payload.payment_method as string) : row.paymentMethod,
                                    notes: (payload.notes as string | null | undefined) ?? row.notes,
                                    categoryId: (payload.category_id as string | null | undefined) ?? row.categoryId,
                                    category:
                                        payload.category_id && categoryMap.has(payload.category_id as string)
                                            ? (categoryMap.get(payload.category_id as string) as Transaction['category'])
                                            : row.category,
                                    accountId: (payload.account_id as string | null | undefined) ?? row.accountId,
                                    account:
                                        payload.account_id && accountMap.has(payload.account_id as string)
                                            ? (accountMap.get(payload.account_id as string) as Transaction['account'])
                                            : row.account,
                                    payee:
                                        payload.payee !== undefined
                                            ? ((payload.payee as string | null | undefined) ?? null)
                                            : row.payee,
                                    updatedAt: new Date().toISOString(),
                                }
                                : row,
                        );
                    }
                    case 'transaction:delete': {
                        const id = payload.id as string | undefined;
                        if (!id) return prev;
                        setTotal((t) => Math.max(0, t - 1));
                        return prev.filter((row) => row.id !== id);
                    }
                    default:
                        return prev;
                }
            });
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('outbox:queued', handler);
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('outbox:queued', handler);
            }
        };
    }, [categoryMap, accountMap, normalizeRows]);

    const toggleSelect = (id: string, checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const selectPage = (checked: boolean) => {
        if (!checked) {
            setSelectedIds(new Set());
            return;
        }
        const next = new Set<string>();
        rows.forEach((row) => next.add(row.id));
        setSelectedIds(next);
    };

    const handleBulkDelete = async () => {
        if (!selectedIds.size) return;
        setIsBulkPending(true);
        try {
            const ids = Array.from(selectedIds);
            await bulkDeleteTransactions(ids);
            setRows((prev) => prev.filter((row) => !selectedIds.has(row.id)));
            setTotal((t) => Math.max(0, t - ids.length));
            setSelectedIds(new Set());
        } catch (error) {
            console.error(error);
            setErrorMessage('Unable to delete selected transactions.');
        } finally {
            setIsBulkPending(false);
        }
    };

    const handleBulkCategory = async () => {
        if (!selectedIds.size || !bulkCategoryId) return;
        setIsBulkPending(true);
        try {
            await bulkUpdateTransactionCategory(Array.from(selectedIds), bulkCategoryId);
            setRows((prev) =>
                prev.map((row) =>
                    selectedIds.has(row.id)
                        ? {
                            ...row,
                            categoryId: bulkCategoryId,
                            category: categoryMap.get(bulkCategoryId) ?? row.category,
                        }
                        : row,
                ),
            );
            setSelectedIds(new Set());
            setBulkCategoryId('');
        } catch (error) {
            console.error(error);
            setErrorMessage('Unable to update category for selected.');
        } finally {
            setIsBulkPending(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / currentPageSize));
    const groups = useMemo(() => groupByDate(rows), [rows]);

    const fetchPage = (nextPage: number, nextPageSize = currentPageSize) => {
        startTransition(async () => {
            try {
                setErrorMessage(null);
                const response = await fetch('/api/transactions/page', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        page: nextPage,
                        pageSize: nextPageSize,
                        filters,
                    }),
                });
                const data = await response.json().catch(() => null);
                if (!response.ok || !data) {
                    throw new Error(data?.error || 'Failed to load transactions');
                }
                const normalized = normalizeRows(data.transactions);
                setRows(normalized);
                setTotal(data.total);
                setCurrentPage(nextPage);
                setCurrentPageSize(nextPageSize);
                cacheTransactions(filters, { transactions: normalized, total: data.total }).catch(() => { });
            } catch (error) {
                console.error('Failed to load transactions page', error);
                const cached = await readCachedTransactions(filters);
                if (cached && (cached as { transactions?: Transaction[]; total?: number }).transactions) {
                    const cachedData = cached as { transactions?: Transaction[]; total?: number };
                    setRows(normalizeRows(cachedData.transactions ?? []));
                    setTotal(cachedData.total ?? 0);
                    setErrorMessage('Showing cached data (offline)');
                } else {
                    setErrorMessage(error instanceof Error ? error.message : 'Failed to load transactions');
                }
            }
        });
    };

    const pager = buildPager(totalPages, currentPage);

    return (
        <section className="space-y-4">
            {renderFilters ?? null}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                    <p className="text-xs text-slate-500">
                        Showing {total === 0 ? 0 : `${(currentPage - 1) * currentPageSize + 1}-${Math.min(currentPage * currentPageSize, total)}`} of {total}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold text-slate-500">
                        Show/page
                        <select
                            className="ml-2 rounded-xl border border-slate-200 px-3 py-1 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            value={currentPageSize}
                            onChange={(event) => {
                                const nextSize = Number(event.target.value);
                                fetchPage(1, nextSize);
                            }}
                        >
                            {PAGE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>
                    {allowEditing ? (
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                                onChange={(e) => selectPage(e.target.checked)}
                                checked={rows.length > 0 && selectedIds.size === rows.length}
                                aria-label="Select page"
                            />
                            Select page
                        </label>
                    ) : null}
                </div>
            </div>

            {allowEditing && selectedIds.size > 0 ? (
                <div className="sticky top-36 z-10 rounded-xl border border-indigo-200 bg-indigo-50 p-3 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-indigo-900">
                            {selectedIds.size} selected
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                value={bulkCategoryId}
                                onChange={(e) => setBulkCategoryId(e.target.value)}
                                disabled={isBulkPending}
                            >
                                <option value="">Change category…</option>
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={handleBulkCategory}
                                disabled={!bulkCategoryId || isBulkPending}
                                className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Apply
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowBulkConfirm(true)}
                                disabled={isBulkPending}
                                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Delete selected
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {showBulkConfirm ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
                        <p className="text-sm font-semibold text-slate-900">Delete {selectedIds.size} selected?</p>
                        <p className="mt-2 text-xs text-slate-600">This will move them to deleted. Undo per item will still work where available.</p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                                onClick={() => setShowBulkConfirm(false)}
                                disabled={isBulkPending}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
                                onClick={() => {
                                    setShowBulkConfirm(false);
                                    handleBulkDelete();
                                }}
                                disabled={isBulkPending}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {rows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">{emptyMessage}</p>
            ) : (
                <div className="space-y-4">
                    {groups.map((group) => (
                        <div key={group.key} className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</h3>
                            <div className="space-y-3">
                                {group.items.map((transaction) => {
                                    const isSelected = selectedIds.has(transaction.id);
                                    return (
                                        <div
                                            key={transaction.id}
                                            className={`group relative rounded-2xl border border-transparent bg-white transition hover:border-indigo-100 ${isSelected ? 'ring-2 ring-indigo-200' : ''
                                                }`}
                                        >
                                            {/* {allowEditing ? (
                                                <div className="absolute left-3 top-3 z-[5]">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded-md border-slate-300 text-indigo-600 opacity-80 transition focus:ring-2 focus:ring-indigo-200 group-hover:opacity-100"
                                                        checked={isSelected}
                                                        onChange={(e) => toggleSelect(transaction.id, e.target.checked)}
                                                        disabled={isBulkPending}
                                                        aria-label="Select transaction"
                                                    />
                                                </div>
                                            ) : null} */}
                                            <div className="flex-1 p-1 ">
                                                <TransactionItem
                                                    transaction={transaction}
                                                    categories={categories}
                                                    accounts={accounts}
                                                    payees={payees}
                                                    enableEditing={allowEditing}
                                                    onSelect={() => toggleSelect(transaction.id, !selectedIds.has(transaction.id))}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

            {totalPages > 1 ? (
                <div className="flex flex-col gap-2 pt-2 text-sm">
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => fetchPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1 || isPending}
                            className={`rounded-xl border px-3 py-1 font-semibold ${currentPage === 1 ? 'cursor-not-allowed border-slate-200 text-slate-300' : 'border-slate-200 text-slate-700 hover:border-indigo-200 hover:text-indigo-600'
                                }`}
                        >
                            Previous
                        </button>
                        <div className="flex items-center gap-1">
                            {pager.map((entry, index) =>
                                entry === 'ellipsis' ? (
                                    <span key={`ellipsis-${index}`} className="px-2 text-slate-400">
                                        ...
                                    </span>
                                ) : (
                                    <button
                                        key={entry}
                                        type="button"
                                        onClick={() => fetchPage(entry)}
                                        disabled={isPending}
                                        className={`rounded-xl border px-2.5 py-1 text-sm font-semibold ${entry === currentPage
                                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                            : 'border-slate-200 text-slate-700 hover-border-indigo-200 hover:text-indigo-600'
                                            }`}
                                    >
                                        {entry}
                                    </button>
                                ),
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => fetchPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages || isPending}
                            className={`rounded-xl border px-3 py-1 font-semibold ${currentPage === totalPages ? 'cursor-not-allowed border-slate-200 text-slate-300' : 'border-slate-200 text-slate-700 hover:border-indigo-200 hover:text-indigo-600'
                                }`}
                        >
                            Next
                        </button>
                    </div>
                    <p className="text-center text-xs text-slate-500">
                        Page {currentPage} of {totalPages}
                    </p>
                </div>
            ) : null}

            {isPending ? (
                <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/95 px-4 py-2 text-xs font-semibold text-white shadow-lg">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                        Loading transactions…
                    </div>
                </div>
            ) : null}
        </section>
    );
}

function groupByDate(rows: Transaction[]) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    const map = new Map<string, Transaction[]>();
    rows.forEach((row) => {
        const key = row.occurredOn;
        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key)!.push(row);
    });
    // Preserve the order from the server so pagination + sorting stay consistent.
    return Array.from(map.entries()).map(([key, items]) => ({
        key,
        label: formatter.format(new Date(key)),
        items,
    }));
}

function buildPager(total: number, current: number) {
    if (total <= 7) {
        return Array.from({ length: total }, (_, index) => index + 1);
    }

    const window = 2;
    const pages: (number | 'ellipsis')[] = [1];
    let start = Math.max(2, current - window);
    const end = Math.min(total - 1, current + window);

    if (start > 2) {
        pages.push('ellipsis');
    } else {
        start = 2;
    }

    for (let page = start; page <= end; page += 1) {
        pages.push(page);
    }

    if (end < total - 1) {
        pages.push('ellipsis');
    }

    pages.push(total);
    return pages;
}
