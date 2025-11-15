'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Select, { components, type GroupBase, type MultiValue, type OptionProps, type StylesConfig } from 'react-select';
import { MdFilterAlt, MdFilterAltOff } from "react-icons/md";

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

    const categoryOptions = useMemo(() => {
        const expense = categories.filter((category) => category.type === 'expense');
        const income = categories.filter((category) => category.type === 'income');
        return { expense, income };
    }, [categories]);

    type CategorySelectOption = { value: string; label: string };

    const groupedSelectOptions = useMemo<GroupBase<CategorySelectOption>[]>(() => {
        const groups: GroupBase<CategorySelectOption>[] = [];
        if (categoryOptions.expense.length) {
            groups.push({
                label: 'Expenses',
                options: categoryOptions.expense.map((category) => ({
                    value: category.name,
                    label: category.name,
                })),
            });
        }
        if (categoryOptions.income.length) {
            groups.push({
                label: 'Income',
                options: categoryOptions.income.map((category) => ({
                    value: category.name,
                    label: category.name,
                })),
            });
        }
        return groups;
    }, [categoryOptions.expense, categoryOptions.income]);

    const flattenedCategoryOptions = useMemo(() => groupedSelectOptions.flatMap((group) => group.options), [groupedSelectOptions]);
    const selectValue = useMemo(() => flattenedCategoryOptions.filter((option) => categoryNames.includes(option.value)), [flattenedCategoryOptions, categoryNames]);
    const allSelected = flattenedCategoryOptions.length > 0 && categoryNames.length === flattenedCategoryOptions.length;

    const handleCategorySelect = useCallback(
        (options: MultiValue<CategorySelectOption>) => {
            if (options.some((option) => option.value === '__all__')) {
                setCategoryNames(flattenedCategoryOptions.map((option) => option.value));
                return;
            }
            setCategoryNames(options.map((option) => option.value));
        },
        [flattenedCategoryOptions],
    );

    const handleSelectAll = useCallback(() => {
        if (allSelected) {
            setCategoryNames([]);
        } else {
            setCategoryNames(flattenedCategoryOptions.map((option) => option.value));
        }
    }, [allSelected, flattenedCategoryOptions]);

    const selectOptions = useMemo(
        () =>
            [
                { value: '__all__', label: 'Select all categories' },
                ...groupedSelectOptions,
            ] as (CategorySelectOption | GroupBase<CategorySelectOption>)[],
        [groupedSelectOptions],
    );

    const selectComponents = useMemo(
        () => ({
            Option: (props: OptionProps<CategorySelectOption, true>) => {
                const isSelectAll = props.data.value === '__all__';
                return (
                    <components.Option {...props}>
                        <span className={isSelectAll ? 'font-semibold text-slate-900' : ''}>{props.children}</span>
                    </components.Option>
                );
            },
        }),
        [],
    );

    const selectStyles = useMemo<StylesConfig<CategorySelectOption, true>>(
        () => ({
            control: (base, state) => ({
                ...base,
                borderRadius: '0.75rem',
                borderColor: state.isFocused ? '#818cf8' : '#d1d5db',
                minHeight: '2.75rem',
                boxShadow: 'none',
                '&:hover': {
                    borderColor: '#818cf8',
                },
            }),
            multiValue: (base) => ({
                ...base,
                borderRadius: '9999px',
                backgroundColor: '#eef2ff',
            }),
            multiValueLabel: (base) => ({
                ...base,
                color: '#4338ca',
                fontWeight: 600,
            }),
            option: (base, state) => ({
                ...base,
                backgroundColor: state.isSelected ? '#eef2ff' : state.isFocused ? '#f8fafc' : undefined,
                color: state.isSelected ? '#4338ca' : '#0f172a',
                fontWeight: state.data.value === '__all__' ? 600 : 500,
            }),
        }),
        [],
    );

    const applyFilters = useCallback(() => {
        const next = new URLSearchParams(searchParams.toString());
        next.delete('start');
        next.delete('end');
        next.delete('category');
        next.delete('payment');
        next.delete('search');

        if (startDate) next.set('start', startDate);
        if (endDate) next.set('end', endDate);
        if (categoryNames.length) {
            categoryNames.forEach((name) => next.append('category', name));
        }
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
        categoryNames,
        paymentMethod,
        search,
        pathname,
        router,
        searchParams,
    ]);

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

                            <div className="grid gap-2">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Categories</p>
                                        <p className="text-xs text-slate-500">Click to choose multiple categories. Leave empty for all.</p>
                                    </div>
                                </div>
                                <Select
                                    isMulti
                                    closeMenuOnSelect={false}
                                    hideSelectedOptions={false}
                                    className="text-sm font-medium text-slate-900"
                                    classNamePrefix="dashboard-select"
                                    placeholder="All categories"
                                    value={selectValue}
                                    onChange={handleCategorySelect}
                                    options={selectOptions}
                                    components={selectComponents}
                                    styles={selectStyles}
                                />
                            </div>

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
