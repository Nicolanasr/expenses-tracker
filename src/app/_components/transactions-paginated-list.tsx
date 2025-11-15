'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { TransactionItem } from '@/app/_components/transaction-item';

const PAGE_OPTIONS = [7, 14, 28, 56, 112];

export type Transaction = {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  currencyCode: string;
  occurredOn: string;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'other';
  notes: string | null;
  categoryId: string | null;
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    type: 'income' | 'expense';
  } | null;
};

export type CategoryOption = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: 'income' | 'expense';
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
};

type Props = {
  initialTransactions: Transaction[];
  totalCount: number;
  pageSize: number;
  page: number;
  filters: TransactionFilters;
  categories: CategoryOption[];
  allowEditing?: boolean;
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
  allowEditing = false,
  renderFilters,
  title = 'Filtered transactions',
  emptyMessage = 'Nothing here yet. Adjust filters or add a transaction above.',
}: Props) {
  const [rows, setRows] = useState(initialTransactions);
  const [total, setTotal] = useState(totalCount);
  const [currentPage, setCurrentPage] = useState(page);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialTransactions);
    setTotal(totalCount);
    setCurrentPage(page);
    setCurrentPageSize(pageSize);
    setErrorMessage(null);
  }, [initialTransactions, totalCount, page, pageSize]);

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
        setRows(data.transactions);
        setTotal(data.total);
        setCurrentPage(nextPage);
        setCurrentPageSize(nextPageSize);
      } catch (error) {
        console.error('Failed to load transactions page', error);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load transactions');
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
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">{emptyMessage}</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.key} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</h3>
              <div className="space-y-3">
                {group.items.map((transaction) => (
                  <TransactionItem key={transaction.id} transaction={transaction} categories={categories} enableEditing={allowEditing} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {isPending ? <p className="text-xs text-slate-500">Loading transactions…</p> : null}

      {totalPages > 1 ? (
        <div className="flex flex-col gap-2 pt-2 text-sm">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => fetchPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || isPending}
              className={`rounded-xl border px-3 py-1 font-semibold ${
                currentPage === 1 ? 'cursor-not-allowed border-slate-200 text-slate-300' : 'border-slate-200 text-slate-700 hover:border-indigo-200 hover:text-indigo-600'
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
                    className={`rounded-xl border px-2.5 py-1 text-sm font-semibold ${
                      entry === currentPage
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
              className={`rounded-xl border px-3 py-1 font-semibold ${
                currentPage === totalPages ? 'cursor-not-allowed border-slate-200 text-slate-300' : 'border-slate-200 text-slate-700 hover:border-indigo-200 hover:text-indigo-600'
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
  return Array.from(map.entries())
    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
    .map(([key, items]) => ({ key, label: formatter.format(new Date(key)), items }));
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
