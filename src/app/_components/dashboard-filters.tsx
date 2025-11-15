'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { MdFilterAlt, MdFilterAltOff } from "react-icons/md";
import { CategoryMultiSelect } from '@/app/_components/category-multi-select';
import { saveDashboardFilter, deleteDashboardFilter } from '@/app/dashboard/actions';

type CategoryOption = {
    id: string;
    name: string;
    type: 'income' | 'expense';
};

type SavedFilter = {
    id: string;
    name: string;
    query: string;
};

type DashboardFiltersProps = {
    categories: CategoryOption[];
    savedFilters: SavedFilter[];
    initialFilters: {
        start?: string;
        end?: string;
        categoryNames?: string[];
        paymentMethod?: string;
        search?: string;
    };
    summaryInterval: 'month' | 'week' | 'day';
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
    savedFilters,
    initialFilters,
    summaryInterval,
}: DashboardFiltersProps) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [expanded, setExpanded] = useState(false);

    const [startDate, setStartDate] = useState(initialFilters.start ?? '');
    const [endDate, setEndDate] = useState(initialFilters.end ?? '');
    const [categoryNames, setCategoryNames] = useState<string[]>(
        initialFilters.categoryNames ?? [],
    );
    const [paymentMethod, setPaymentMethod] = useState<string>(
        initialFilters.paymentMethod ?? '',
    );
    const [search, setSearch] = useState(initialFilters.search ?? '');
    const [presetName, setPresetName] = useState('');
    const [presetError, setPresetError] = useState<string | null>(null);
    const [presetPending, startPresetTransition] = useTransition();
    const [deletePendingId, setDeletePendingId] = useState<string | null>(null);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            if (!initialFilters.start || !initialFilters.end) {
                const [presetStart, presetEnd] = presets[0].getRange();
                setStartDate(toInputValue(presetStart));
                setEndDate(toInputValue(presetEnd));
                setExpanded(false);
                return;
            }

            setStartDate(initialFilters.start ?? '');
            setEndDate(initialFilters.end ?? '');
            setCategoryNames(initialFilters.categoryNames ?? []);
            setPaymentMethod(initialFilters.paymentMethod ?? '');
            setSearch(initialFilters.search ?? '');
        }, 0);

        return () => window.clearTimeout(timeout);
    }, [
        initialFilters.start,
        initialFilters.end,
        initialFilters.categoryNames,
        initialFilters.paymentMethod,
        initialFilters.search,
    ]);

    const buildFilterParams = useCallback(() => {
        const params = new URLSearchParams();
        if (startDate) params.set('start', startDate);
        if (endDate) params.set('end', endDate);
        categoryNames.forEach((name) => params.append('category', name));
        if (paymentMethod) params.set('payment', paymentMethod);
        if (search.trim()) params.set('search', search.trim());
        return params;
    }, [startDate, endDate, categoryNames, paymentMethod, search]);

    const mergeFilterParams = useCallback(
        (filters: URLSearchParams) => {
            const next = new URLSearchParams(searchParams.toString());
            ['start', 'end', 'category', 'payment', 'search'].forEach((key) => next.delete(key));
            filters.forEach((value, key) => {
                if (key === 'category') {
                    next.append(key, value);
                } else {
                    next.set(key, value);
                }
            });
            return next;
        },
        [searchParams],
    );

    const applyFilters = useCallback(() => {
        const merged = mergeFilterParams(buildFilterParams());
        const queryString = merged.toString();
        startTransition(() => {
            router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
                scroll: false,
            });
        });
    }, [buildFilterParams, mergeFilterParams, pathname, router, startTransition]);

    const handleReset = useCallback(() => {
        const next = new URLSearchParams(searchParams.toString());
        next.delete('start');
        next.delete('end');
        next.delete('category');
        next.delete('payment');
        next.delete('search');

        const [presetStart, presetEnd] = presets[0].getRange();
        setStartDate(toInputValue(presetStart));
        setEndDate(toInputValue(presetEnd));
        setCategoryNames([]);
        setPaymentMethod('');
        setSearch('');

        const queryString = next.toString();
        startTransition(() => {
            router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
                scroll: false,
            });
        });
    }, [pathname, router, searchParams]);

    const handleIntervalChange = useCallback(
        (value: 'month' | 'week' | 'day') => {
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

    const handleApplyPreset = useCallback(
        (query: string) => {
            const merged = mergeFilterParams(new URLSearchParams(query));
            startTransition(() => {
                router.replace(merged.toString() ? `${pathname}?${merged}` : pathname, {
                    scroll: false,
                });
            });
        },
        [mergeFilterParams, pathname, router, startTransition],
    );

    const handleSavePreset = () => {
        const trimmedName = presetName.trim();
        if (!trimmedName) {
            setPresetError('Give your preset a name.');
            return;
        }
        const params = buildFilterParams();
        const queryString = params.toString();
        if (!queryString) {
            setPresetError('Adjust some filters before saving.');
            return;
        }
        setPresetError(null);
        startPresetTransition(async () => {
            try {
                await saveDashboardFilter({ name: trimmedName, query: queryString });
                setPresetName('');
            } catch (error) {
                setPresetError(error instanceof Error ? error.message : 'Unable to save preset.');
            }
        });
    };

    const handleDeletePreset = (id: string) => {
        setDeletePendingId(id);
        startPresetTransition(async () => {
            try {
                await deleteDashboardFilter({ id });
            } catch (error) {
                console.error(error);
            } finally {
                setDeletePendingId((current) => (current === id ? null : current));
            }
        });
    };

    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
                        <p className="text-sm text-slate-500">
                            Narrow your view by time range, category, method, or keywords.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="inline-flex items-center rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-500">
                            <button
                                type="button"
                                onClick={() => handleIntervalChange('month')}
                                className={`rounded-full px-3 py-1 transition ${summaryInterval === 'month'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'hover:text-slate-700'
                                    }`}
                            >
                                Monthly
                            </button>
                            <button
                                type="button"
                                onClick={() => handleIntervalChange('week')}
                                className={`rounded-full px-3 py-1 transition ${summaryInterval === 'week'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'hover:text-slate-700'
                                    }`}
                            >
                                Weekly
                            </button>
                            <button
                                type="button"
                                onClick={() => handleIntervalChange('day')}
                                className={`rounded-full px-3 py-1 transition ${summaryInterval === 'day'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'hover:text-slate-700'
                                    }`}
                            >
                                Daily
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => setExpanded((prev) => !prev)}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                        >
                            {expanded ? <MdFilterAltOff /> : <MdFilterAlt />}
                            {/* <span className="text-xs font-medium text-slate-400">
                                {expanded ? '−' : '+'}
                            </span> */}
                        </button>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-900">Saved presets</p>
                            <p className="text-xs text-slate-500">Keep up to two favorite filter combos.</p>
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                            <input
                                type="text"
                                value={presetName}
                                onChange={(event) => setPresetName(event.target.value)}
                                placeholder="Preset name"
                                className="h-9 flex-1 rounded-full border border-slate-300 px-3 text-xs font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100 sm:w-40"
                                disabled={presetPending}
                            />
                            <button
                                type="button"
                                onClick={handleSavePreset}
                                disabled={presetPending}
                                className="inline-flex h-9 items-center justify-center rounded-full bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {presetPending ? 'Saving…' : 'Save preset'}
                            </button>
                        </div>
                    </div>
                    {presetError ? <p className="mt-2 text-xs text-rose-500">{presetError}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                        {savedFilters.length ? (
                            savedFilters.map((preset) => (
                                <div
                                    key={preset.id}
                                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleApplyPreset(preset.query)}
                                        className="transition hover:text-indigo-600"
                                    >
                                        {preset.name}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeletePreset(preset.id)}
                                        disabled={presetPending && deletePendingId === preset.id}
                                        className="text-slate-400 transition hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                                        aria-label={`Remove ${preset.name}`}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-slate-500">No presets saved yet.</p>
                        )}
                    </div>
                </div>

                {expanded ? (
                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-start">
                            <div className="grid gap-2">

                                <p className="text-sm font-semibold text-slate-900">Date range</p>
                                <div className="flex gap-2">
                                    <input
                                        id="start"
                                        name="start"
                                        type="date"
                                        value={startDate}
                                        onChange={(event) => setStartDate(event.target.value)}
                                        className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                                    />
                                    <input
                                        id="end"
                                        name="end"
                                        type="date"
                                        value={endDate}
                                        onChange={(event) => setEndDate(event.target.value)}
                                        className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {presets.map((preset) => (
                                        <button
                                            key={preset.label}
                                            type="button"
                                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600"
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

                            <CategoryMultiSelect
                                categories={categories}
                                value={categoryNames}
                                onChange={setCategoryNames}
                                label="Categories"
                                description="Click to choose multiple categories. Leave empty for all."
                            />

                            <div className="grid gap-2">
                                <p className="text-sm font-semibold text-slate-900">Payment method</p>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('')}
                                        className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${paymentMethod === ''
                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                                            : 'border-slate-200 text-slate-700 hover:border-indigo-200 hover:text-indigo-600'
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
                                                className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${isActive
                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                                                    : 'border-slate-200 text-slate-700 hover:border-indigo-200 hover:text-indigo-600'
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
                                <p className="text-sm font-semibold text-slate-900">Search</p>
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
                                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleReset}
                                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                                disabled={pending}
                            >
                                Clear filters
                            </button>
                            <button
                                type="button"
                                onClick={applyFilters}
                                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                                disabled={pending}
                            >
                                {pending ? 'Updating…' : 'Apply filters'}
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </section>
    );
}
