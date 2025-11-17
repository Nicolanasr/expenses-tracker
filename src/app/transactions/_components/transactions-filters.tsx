'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { CategoryMultiSelect } from '@/app/_components/category-multi-select';

const PAYMENT_METHODS = ['card', 'cash', 'transfer', 'other'] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number] | '';

type CategoryOption = {
    id: string;
    name: string;
    type: 'income' | 'expense';
};

type TransactionsFiltersProps = {
    categories: CategoryOption[];
    initialFilters: {
        start: string;
        end: string;
        categoryNames: string[];
        paymentMethod: string;
        type: string;
        minAmount: string;
        maxAmount: string;
        sort: string;
    };
    compact?: boolean;
};

export function TransactionsFilters({
    categories,
    initialFilters,
    compact = false,
}: TransactionsFiltersProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [pending, startTransition] = useTransition();

    const [startDate, setStartDate] = useState(initialFilters.start);
    const [endDate, setEndDate] = useState(initialFilters.end);
    const [categoryNames, setCategoryNames] = useState<string[]>(initialFilters.categoryNames);
    const normalizePaymentMethod = (value: string | undefined) => {
        if (!value) return '';
        return (PAYMENT_METHODS as readonly string[]).includes(value)
            ? (value as PaymentMethod)
            : '';
    };

    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
        normalizePaymentMethod(initialFilters.paymentMethod),
    );
    const [type, setType] = useState(initialFilters.type ?? '');
    const [minAmount, setMinAmount] = useState(initialFilters.minAmount ?? '');
    const [maxAmount, setMaxAmount] = useState(initialFilters.maxAmount ?? '');
    const [sort, setSort] = useState(initialFilters.sort ?? 'recent');

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setStartDate(initialFilters.start ?? '');
            setEndDate(initialFilters.end ?? '');
            setCategoryNames(initialFilters.categoryNames ?? []);
            setPaymentMethod(normalizePaymentMethod(initialFilters.paymentMethod));
            setType(initialFilters.type ?? '');
            setMinAmount(initialFilters.minAmount ?? '');
            setMaxAmount(initialFilters.maxAmount ?? '');
            setSort(initialFilters.sort ?? 'recent');
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [
        initialFilters.start,
        initialFilters.end,
        initialFilters.categoryNames,
        initialFilters.paymentMethod,
        initialFilters.type,
        initialFilters.minAmount,
        initialFilters.maxAmount,
        initialFilters.sort,
    ]);

    const applyFilters = () => {
        const next = new URLSearchParams(searchParams.toString());
        next.delete('start');
        next.delete('end');
        next.delete('category');
        next.delete('payment');
        next.delete('type');
        next.delete('minAmount');
        next.delete('maxAmount');
        next.delete('sort');

        if (startDate) next.set('start', startDate);
        if (endDate) next.set('end', endDate);
        categoryNames.forEach((name) => next.append('category', name));
        if (paymentMethod) next.set('payment', paymentMethod);
        if (type) next.set('type', type);
        if (minAmount) next.set('minAmount', minAmount);
        if (maxAmount) next.set('maxAmount', maxAmount);
        if (sort && sort !== 'recent') next.set('sort', sort);

        const queryString = next.toString();
        startTransition(() => {
            router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
                scroll: false,
            });
        });
    };

    const handleReset = () => {
        const next = new URLSearchParams(searchParams.toString());
        next.delete('start');
        next.delete('end');
        next.delete('category');
        next.delete('payment');
        next.delete('type');
        next.delete('minAmount');
        next.delete('maxAmount');
        next.delete('sort');

        const today = new Date();
        const defaultEnd = today.toISOString().slice(0, 10);
        const defaultStartDate = new Date(today);
        defaultStartDate.setDate(defaultStartDate.getDate() - 29);
        const defaultStart = defaultStartDate.toISOString().slice(0, 10);

        setStartDate(defaultStart);
        setEndDate(defaultEnd);
        setCategoryNames([]);
        setPaymentMethod('');
        setType('');
        setMinAmount('');
        setMaxAmount('');
        setSort('recent');

        startTransition(() => {
            const queryString = next.toString();
            router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
                scroll: false,
            });
        });
    };

    return (
        <div className="space-y-4">
            <div className={`grid gap-4 ${compact ? 'md:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3 items-start'}`}>
                <div className="grid gap-2">
                    <p className="text-sm font-semibold text-slate-900">Date range</p>
                    <div className="flex gap-2">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(event) => setStartDate(event.target.value)}
                            className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                        />
                        <input
                            type="date"
                            value={endDate}
                            onChange={(event) => setEndDate(event.target.value)}
                            className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                        />
                    </div>
                </div>

                <CategoryMultiSelect
                    categories={categories}
                    value={categoryNames}
                    onChange={setCategoryNames}
                    label="Categories"
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
                        {PAYMENT_METHODS.map((method) => {
                            const isActive = paymentMethod === method;
                            return (
                                <button
                                    key={method}
                                    type="button"
                                    onClick={() => setPaymentMethod(method)}
                                    className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${isActive
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                                        : 'border-slate-200 text-slate-700 hover:border-indigo-200 hover:text-indigo-600'
                                        }`}
                                >
                                    {method}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="grid gap-2">
                    <p className="text-sm font-semibold text-slate-900">Type</p>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { value: '', label: 'Income & expense' },
                            { value: 'income', label: 'Income' },
                            { value: 'expense', label: 'Expense' },
                        ].map((option) => {
                            const isActive = type === option.value;
                            return (
                                <button
                                    key={option.value || 'all-types'}
                                    type="button"
                                    onClick={() => setType(option.value)}
                                    className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${isActive
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                                        : 'border-slate-200 text-slate-700 hover:border-indigo-200 hover:text-indigo-600'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="grid gap-2">
                    <p className="text-sm font-semibold text-slate-900">Min amount</p>
                    <input
                        type="number"
                        step="0.01"
                        value={minAmount}
                        onChange={(event) => setMinAmount(event.target.value)}
                        className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                    />
                </div>

                <div className="grid gap-2">
                    <p className="text-sm font-semibold text-slate-900">Max amount</p>
                    <input
                        type="number"
                        step="0.01"
                        value={maxAmount}
                        onChange={(event) => setMaxAmount(event.target.value)}
                        className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                    />
                </div>

                <div className="grid gap-2">
                    <p className="text-sm font-semibold text-slate-900">Sort</p>
                    <select
                        value={sort}
                        onChange={(event) => setSort(event.target.value)}
                        className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                    >
                        <option value="recent">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="amount_desc">Amount: high to low</option>
                        <option value="amount_asc">Amount: low to high</option>
                    </select>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-60"
                    disabled={pending}
                >
                    Clear filters
                </button>
                <button
                    type="button"
                    onClick={applyFilters}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                    disabled={pending}
                >
                    {pending ? 'Updating…' : 'Apply filters'}
                </button>
            </div>
        </div>
    );
}
