'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';

type CategoryOption = {
  id: string;
  name: string;
  type: 'income' | 'expense';
};

type DashboardFiltersProps = {
  categories: CategoryOption[];
  initialFilters: {
    start?: string;
    end?: string;
    categoryId?: string;
    paymentMethod?: string;
    search?: string;
  };
  summaryInterval: 'month' | 'week';
};

const PAYMENT_METHOD_LABELS = {
  card: 'Card',
  cash: 'Cash',
  transfer: 'Bank transfer',
  other: 'Other',
} as const;

type PaymentMethodValue = keyof typeof PAYMENT_METHOD_LABELS;

const presets = [
  {
    label: 'This month',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return [start, end] as const;
    },
  },
  {
    label: 'Last 30 days',
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return [start, end] as const;
    },
  },
  {
    label: 'Year to date',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date();
      return [start, end] as const;
    },
  },
];

function toInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function DashboardFilters({
  categories,
  initialFilters,
  summaryInterval,
}: DashboardFiltersProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [startDate, setStartDate] = useState(initialFilters.start ?? '');
  const [endDate, setEndDate] = useState(initialFilters.end ?? '');
  const [categoryId, setCategoryId] = useState(initialFilters.categoryId ?? '');
  const [paymentMethod, setPaymentMethod] = useState<string>(
    initialFilters.paymentMethod ?? '',
  );
  const [search, setSearch] = useState(initialFilters.search ?? '');

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setStartDate(initialFilters.start ?? '');
      setEndDate(initialFilters.end ?? '');
      setCategoryId(initialFilters.categoryId ?? '');
      setPaymentMethod(initialFilters.paymentMethod ?? '');
      setSearch(initialFilters.search ?? '');
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [
    initialFilters.start,
    initialFilters.end,
    initialFilters.categoryId,
    initialFilters.paymentMethod,
    initialFilters.search,
  ]);

  const categoryOptions = useMemo(() => {
    const expense = categories.filter((category) => category.type === 'expense');
    const income = categories.filter((category) => category.type === 'income');
    return { expense, income };
  }, [categories]);

  const applyFilters = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('start');
    next.delete('end');
    next.delete('category');
    next.delete('payment');
    next.delete('search');

    if (startDate) next.set('start', startDate);
    if (endDate) next.set('end', endDate);
    if (categoryId) next.set('category', categoryId);
    if (paymentMethod) next.set('payment', paymentMethod);
    if (search.trim()) next.set('search', search.trim());

    const queryString = next.toString();
    startTransition(() => {
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    });
  }, [
    startDate,
    endDate,
    categoryId,
    paymentMethod,
    search,
    pathname,
    router,
    searchParams,
  ]);

  const handleReset = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setCategoryId('');
    setPaymentMethod('');
    setSearch('');

    const next = new URLSearchParams(searchParams.toString());
    next.delete('start');
    next.delete('end');
    next.delete('category');
    next.delete('payment');
    next.delete('search');

    const queryString = next.toString();
    startTransition(() => {
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    });
  }, [pathname, router, searchParams]);

  const handleIntervalChange = useCallback(
    (value: 'month' | 'week') => {
      const next = new URLSearchParams(searchParams.toString());
      next.set('interval', value);
      const queryString = next.toString();
      startTransition(() => {
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
          scroll: false,
        });
      });
    },
    [pathname, router, searchParams],
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Filters</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleIntervalChange('month')}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                summaryInterval === 'month'
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'border border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => handleIntervalChange('week')}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                summaryInterval === 'week'
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'border border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
              }`}
            >
              Weekly
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-2">
            <label htmlFor="start" className="text-sm font-semibold text-slate-800">
              Start date
            </label>
            <input
              id="start"
              name="start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
            />
            <div className="flex flex-wrap gap-2 pt-1 text-xs text-slate-600">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="rounded-full border border-slate-200 px-2 py-1 transition hover:border-indigo-200 hover:text-indigo-600"
                  onClick={() => {
                    const [presetStart, presetEnd] = preset.getRange();
                    setStartDate(toInputValue(presetStart));
                    setEndDate(toInputValue(presetEnd));
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <label htmlFor="end" className="text-sm font-semibold text-slate-800">
              End date
            </label>
            <input
              id="end"
              name="end"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-slate-800">Category</label>
            <select
              name="categoryId"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
            >
              <option value="">All categories</option>
              {categoryOptions.expense.length ? (
                <optgroup label="Expenses">
                  {categoryOptions.expense.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {categoryOptions.income.length ? (
                <optgroup label="Income">
                  {categoryOptions.income.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-semibold text-slate-800">Payment method</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('')}
                className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                  paymentMethod === ''
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                    : 'border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
                }`}
              >
                All methods
              </button>
              {(Object.entries(
                PAYMENT_METHOD_LABELS,
              ) as Array<[PaymentMethodValue, string]>).map(([value, label]) => {
                const isActive = paymentMethod === value;
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setPaymentMethod(value)}
                    className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                        : 'border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
            <label className="text-sm font-semibold text-slate-800">Search</label>
            <input
              name="search"
              type="search"
              placeholder="Search notes or category name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applyFilters();
                }
              }}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            disabled={pending}
          >
            Clear filters
          </button>
          <button
            type="button"
            onClick={applyFilters}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={pending}
          >
            {pending ? 'Updating…' : 'Apply filters'}
          </button>
        </div>
      </div>
    </section>
  );
}
