'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { createTransaction } from '@/app/actions';

type Category = {
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: string | null;
    color: string | null;
};

type FormState = {
    ok: boolean;
    errors?: Record<string, string[] | undefined>;
};

const INITIAL_STATE: FormState = { ok: false, errors: {} };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-emerald-500 px-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={pending}
        >
            {pending ? 'Saving…' : 'Record Transaction'}
        </button>
    );
}

const PAYMENT_METHOD_LABELS = {
    card: 'Card',
    cash: 'Cash',
    transfer: 'Bank transfer',
    other: 'Other',
} as const;

function getCategoryIcon(category: Category) {
    if (category.icon && category.icon.trim().length > 0) {
        return category.icon;
    }
    return category.type === 'income' ? '💵' : '💳';
}

type Props = {
    categories: Category[];
};

export function CreateTransactionForm({ categories }: Props) {
    const formRef = useRef<HTMLFormElement>(null);
    const [state, formAction] = useActionState(
        createTransaction,
        INITIAL_STATE,
    );
    const [activeType, setActiveType] = useState<'income' | 'expense'>('expense');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<
        keyof typeof PAYMENT_METHOD_LABELS
    >('card');

    useEffect(() => {
        if (!state.ok) {
            return;
        }
        const timeout = window.setTimeout(() => {
            formRef.current?.reset();
            setSelectedCategory('');
            setPaymentMethod('card');
            setActiveType(
                categories.some((category) => category.type === 'expense')
                    ? 'expense'
                    : 'income',
            );
        }, 0);

        return () => window.clearTimeout(timeout);
    }, [state.ok, categories]);

    const defaultDate = useMemo(() => {
        const now = new Date();
        return now.toISOString().slice(0, 10);
    }, []);

    const categoryGroups = useMemo(() => {
        return categories.reduce<Record<'income' | 'expense', Category[]>>(
            (acc, category) => {
                acc[category.type].push(category);
                return acc;
            },
            { income: [], expense: [] },
        );
    }, [categories]);

    const tabOptions = useMemo(
        () => [
            {
                value: 'expense' as const,
                label: 'Expenses',
                count: categoryGroups.expense.length,
            },
            {
                value: 'income' as const,
                label: 'Income',
                count: categoryGroups.income.length,
            },
        ],
        [categoryGroups],
    );

    const activeCategories =
        activeType === 'expense'
            ? categoryGroups.expense
            : categoryGroups.income;

    useEffect(() => {
        let nextType = activeType;
        let nextSelected = selectedCategory;
        let shouldUpdateType = false;
        let shouldUpdateSelection = false;

        if (!categories.length) {
            if (selectedCategory !== '') {
                nextSelected = '';
                shouldUpdateSelection = true;
            }
        } else {
            const fallbackType = categoryGroups.expense.length
                ? 'expense'
                : 'income';

            if (
                categoryGroups[activeType].length === 0 &&
                fallbackType !== activeType
            ) {
                nextType = fallbackType;
                shouldUpdateType = true;
            }

            if (
                nextSelected &&
                !categories.some((category) => category.id === nextSelected)
            ) {
                nextSelected = '';
                shouldUpdateSelection = true;
            }

            const activeList = categoryGroups[nextType];
            if (
                nextSelected &&
                !activeList.some((category) => category.id === nextSelected)
            ) {
                nextSelected = '';
                shouldUpdateSelection = true;
            }
        }

        if (!shouldUpdateType && !shouldUpdateSelection) {
            return;
        }

        const timeout = window.setTimeout(() => {
            if (shouldUpdateType) {
                setActiveType(nextType);
            }
            if (shouldUpdateSelection) {
                setSelectedCategory(nextSelected);
            }
        }, 0);

        return () => window.clearTimeout(timeout);
    }, [activeType, categories, categoryGroups, selectedCategory]);

    return (
        <form
            ref={formRef}
            action={formAction}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
            <div>
                <h3 className="text-sm font-semibold text-slate-900">
                    Record a transaction
                </h3>
                <p className="text-xs text-slate-600">
                    Track income and expenses across categories.
                </p>
            </div>

            <div className="space-y-2">
                <label
                    htmlFor="transaction-amount"
                    className="text-sm font-semibold text-slate-800"
                >
                    Amount
                </label>
                <div className="flex items-center gap-2">
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 text-sm text-slate-700">
                        $
                    </span>
                    <input
                        id="transaction-amount"
                        name="amount"
                        type="number"
                        step="0.01"
                        min={0}
                        required
                        placeholder="0.00"
                        className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                    />
                </div>
                {state.errors?.amount?.length ? (
                    <p className="text-xs text-red-500">{state.errors.amount[0]}</p>
                ) : null}
            </div>

            <div className="space-y-2">
                <label
                    htmlFor="transaction-date"
                    className="text-sm font-semibold text-slate-800"
                >
                    Date
                </label>
                <input
                    id="transaction-date"
                    name="occurred_on"
                    type="date"
                    defaultValue={defaultDate}
                    required
                    className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                />
                {state.errors?.occurred_on?.length ? (
                    <p className="text-xs text-red-500">{state.errors.occurred_on[0]}</p>
                ) : null}
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">
                        Category
                    </p>
                    <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-500">
                        {tabOptions.map((tab) => {
                            const isActive = activeType === tab.value;
                            return (
                                <button
                                    key={tab.value}
                                    type="button"
                                    onClick={() => setActiveType(tab.value)}
                                    disabled={!tab.count}
                                    className={`rounded-full px-3 py-1 transition ${
                                        isActive
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'hover:text-slate-700'
                                    } ${
                                        !tab.count
                                            ? 'cursor-not-allowed opacity-40'
                                            : ''
                                    }`}
                                >
                                    {tab.label}
                                    <span className="ml-1 text-[11px] text-slate-400">
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                {categories.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-600">
                        Add a category first so you can log transactions.
                    </p>
                ) : activeCategories.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-600">
                        No categories yet for this tab. Switch tabs or create a
                        new category.
                    </p>
                ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {activeCategories.map((category, index) => {
                            const icon = getCategoryIcon(category);
                            const isSelected = selectedCategory === category.id;
                            const shouldRequire = index === 0 && !selectedCategory;
                            return (
                                <label
                                    key={category.id}
                                    className="inline-block h-full cursor-pointer"
                                >
                                    <input
                                        type="radio"
                                        name="category_id"
                                        value={category.id}
                                        className="peer sr-only"
                                        checked={isSelected}
                                        onChange={() =>
                                            setSelectedCategory(category.id)
                                        }
                                        required={shouldRequire}
                                    />
                                    <span
                                        className={`flex h-full items-center gap-3 rounded-xl border p-3 text-sm font-semibold shadow-sm transition ${
                                            isSelected
                                                ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                                                : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-600'
                                        }`}
                                    >
                                        <span className="text-lg" aria-hidden>
                                            {icon}
                                        </span>
                                        <span className="truncate">
                                            {category.name}
                                        </span>
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                )}
                {state.errors?.category_id?.length ? (
                    <p className="text-xs text-red-500">
                        {state.errors.category_id[0]}
                    </p>
                ) : null}
            </div>

            <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-800">
                    Payment method
                </p>
                <div className="flex flex-wrap gap-2">
                    {(Object.entries(
                        PAYMENT_METHOD_LABELS,
                    ) as Array<[keyof typeof PAYMENT_METHOD_LABELS, string]>).map(
                        ([value, label]) => {
                            const isSelected = paymentMethod === value;
                            return (
                                <label
                                    key={value}
                                    className="cursor-pointer rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 data-[active=true]:border-indigo-500 data-[active=true]:bg-indigo-50 data-[active=true]:text-indigo-600"
                                    data-active={isSelected}
                                >
                                    <input
                                        type="radio"
                                        name="payment_method"
                                        value={value}
                                        className="sr-only"
                                        checked={isSelected}
                                        onChange={() => setPaymentMethod(value)}
                                    />
                                    {label}
                                </label>
                            );
                        },
                    )}
                </div>
                {state.errors?.payment_method?.length ? (
                    <p className="text-xs text-red-500">
                        {state.errors.payment_method[0]}
                    </p>
                ) : null}
            </div>

            <div className="space-y-2">
                <label
                    htmlFor="transaction-notes"
                    className="text-sm font-semibold text-slate-800"
                >
                    Notes (optional)
                </label>
                <textarea
                    id="transaction-notes"
                    name="notes"
                    rows={3}
                    placeholder="Add any helpful context"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                />
                {state.errors?.notes?.length ? (
                    <p className="text-xs text-red-500">{state.errors.notes[0]}</p>
                ) : null}
            </div>

            {state.ok ? (
                <p className="text-xs font-medium text-emerald-600">
                    Transaction saved successfully.
                </p>
            ) : null}

            <SubmitButton />
        </form>
    );
}
