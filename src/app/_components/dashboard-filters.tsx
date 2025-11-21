'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { MdFilterAlt, MdFilterAltOff } from "react-icons/md";
import { components, type SingleValue, type OptionProps, type StylesConfig } from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { CategoryMultiSelect } from '@/app/_components/category-multi-select';
import { saveDashboardFilter, deleteDashboardFilter, type SavedFilter as SavedFilterRecord } from '@/app/dashboard/actions';
import toast from 'react-hot-toast';

type CategoryOption = {
    id: string;
    name: string;
    type: 'income' | 'expense';
};

type AccountOption = {
    id: string;
    name: string;
    type: string;
    institution: string | null;
};

type SavedFilter = {
    id: string;
    name: string;
    query: string;
};

type PresetOption = {
    value: string;
    label: string;
    isSave?: boolean;
    presetId?: string;
};

type DashboardFiltersProps = {
    categories: CategoryOption[];
    accounts: AccountOption[];
    savedFilters: SavedFilter[];
    initialFilters: {
        start?: string;
        end?: string;
        categoryNames?: string[];
        paymentMethod?: string;
        search?: string;
        accountId?: string;
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
    accounts,
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
    const [accountId, setAccountId] = useState(initialFilters.accountId ?? '');
    const [search, setSearch] = useState(initialFilters.search ?? '');
    const [presetError, setPresetError] = useState<string | null>(null);
    const [presetPending, startPresetTransition] = useTransition();
    const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
    const [presetSelection, setPresetSelection] = useState<string | null>(null);
    const [localPresets, setLocalPresets] = useState<SavedFilter[]>(savedFilters);

    useEffect(() => {
        setLocalPresets(savedFilters);
    }, [savedFilters]);

    const presetOptions = useMemo<PresetOption[]>(() => {
        const saved = localPresets.map((preset) => ({
            value: preset.query,
            label: preset.name,
            presetId: preset.id,
        }));
        return saved;
    }, [localPresets]);

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
            setAccountId(initialFilters.accountId ?? '');
            setSearch(initialFilters.search ?? '');
        }, 0);

        return () => window.clearTimeout(timeout);
    }, [
        initialFilters.start,
        initialFilters.end,
        initialFilters.categoryNames,
        initialFilters.paymentMethod,
        initialFilters.accountId,
        initialFilters.search,
    ]);

    const buildFilterParams = useCallback(() => {
        const params = new URLSearchParams();
        if (startDate) params.set('start', startDate);
        if (endDate) params.set('end', endDate);
        categoryNames.forEach((name) => params.append('category', name));
        if (paymentMethod) params.set('payment', paymentMethod);
        if (accountId) params.set('account', accountId);
        if (search.trim()) params.set('search', search.trim());
        return params;
    }, [startDate, endDate, categoryNames, paymentMethod, accountId, search]);

    const mergeFilterParams = useCallback(
        (filters: URLSearchParams) => {
            const next = new URLSearchParams(searchParams.toString());
            ['start', 'end', 'category', 'payment', 'search', 'account'].forEach((key) => next.delete(key));
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
        next.delete('account');

        const [presetStart, presetEnd] = presets[0].getRange();
        setStartDate(toInputValue(presetStart));
        setEndDate(toInputValue(presetEnd));
        setCategoryNames([]);
        setPaymentMethod('');
        setAccountId('');
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
        [mergeFilterParams, pathname, router],
    );

    const handleSavePreset = (name: string) => {
        const trimmedName = name.trim();
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
                const created = await saveDashboardFilter({ name: trimmedName, query: queryString });
                const saved = created as SavedFilterRecord;
                setLocalPresets((prev) => {
                    const deduped = prev.filter((p) => p.id !== saved.id);
                    return [saved, ...deduped];
                });
                setPresetSelection(saved.query);
                handleApplyPreset(saved.query);
                toast.success('Preset saved');
            } catch (error) {
                setPresetError(error instanceof Error ? error.message : 'Unable to save preset.');
                toast.error(error instanceof Error ? error.message : 'Unable to save preset');
            }
        });
    };

    const handleDeletePreset = useCallback(
        (id: string, name: string) => {
            if (!window.confirm(`Remove preset "${name}"?`)) {
                return;
            }
            setDeletePendingId(id);
            startPresetTransition(async () => {
                try {
                    await deleteDashboardFilter({ id });
                    setLocalPresets((prev) => prev.filter((p) => p.id !== id));
                    toast.success('Preset removed');
                } catch (error) {
                    console.error(error);
                    toast.error('Unable to remove preset');
                } finally {
                    setDeletePendingId((current) => (current === id ? null : current));
                }
            });
        },
        [],
    );

    const presetSelectComponents = useMemo(
        () => ({
            Option: (props: OptionProps<PresetOption, false>) => {
                const isSave = props.data.isSave;
                const deletable = props.data.presetId;
                return (
                    <components.Option {...props}>
                        <div className="flex items-center justify-between gap-2">
                            <span className={isSave ? 'font-semibold text-slate-900' : ''}>{props.children}</span>
                            {deletable ? (
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        handleDeletePreset(props.data.presetId!, props.data.label);
                                    }}
                                    disabled={presetPending && deletePendingId === props.data.presetId}
                                    className="text-slate-400 transition hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                                    aria-label={`Delete ${props.data.label}`}
                                >
                                    ×
                                </button>
                            ) : null}
                        </div>
                    </components.Option>
                );
            },
        }),
        [deletePendingId, presetPending, handleDeletePreset],
    );

    const presetSelectStyles = useMemo<StylesConfig<PresetOption, false>>(
        () => ({
            control: (base, state) => ({
                ...base,
                borderRadius: 12,
                minHeight: '44px',
                borderColor: state.isFocused ? '#818cf8' : '#d1d5db',
                boxShadow: 'none',
                '&:hover': {
                    borderColor: '#818cf8',
                },
            }),
            option: (base, state) => ({
                ...base,
                backgroundColor: state.isSelected ? '#eef2ff' : state.isFocused ? '#f8fafc' : undefined,
                color: state.isSelected ? '#4338ca' : '#0f172a',
                fontWeight: state.data.isSave ? 700 : 500,
            }),
        }),
        [],
    );

    const handlePresetChange = (option: SingleValue<PresetOption>) => {
        setPresetSelection(option?.value ?? null);
        setPresetError(null);
        if (!option) return;
        if (option.isSave) {
            handleSavePreset(option.label);
            return;
        }
        handleApplyPreset(option.value);
    };

    const handleCreatePresetOption = (inputValue: string) => {
        const name = inputValue.trim();
        if (!name) return;
        setPresetError(null);
        handleSavePreset(name);
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
                                instanceId="dashboard-category-select"
                                label="Categories"
                                description=""
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

                            <div className="grid gap-2">
                                <p className="text-sm font-semibold text-slate-900">Account</p>
                                <select
                                    value={accountId}
                                    onChange={(event) => setAccountId(event.target.value)}
                                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                                >
                                    <option value="">All accounts</option>
                                    {accounts.map((account) => (
                                        <option key={account.id} value={account.id}>
                                            {account.name}
                                        </option>
                                    ))}
                                </select>
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

                            <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
                                <div className="min-w-[16rem] flex-1 sm:flex-none">
                                    <CreatableSelect
                                        classNamePrefix="preset-select"
                                        placeholder="Select/save filters presets"
                                        options={presetOptions}
                                        onChange={handlePresetChange}
                                        onCreateOption={handleCreatePresetOption}
                                        formatCreateLabel={(input: string) => `Save "${input}"`}
                                        isClearable
                                        isSearchable
                                        value={
                                            presetSelection
                                                ? presetOptions.find((opt) => opt.value === presetSelection) ?? null
                                                : null
                                        }
                                        components={presetSelectComponents}
                                        styles={presetSelectStyles}
                                        menuPlacement="bottom"
                                    />
                                </div>
                                {presetError ? <p className="text-xs text-rose-500">{presetError}</p> : null}
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
