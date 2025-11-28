'use client';

import { startTransition, useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import toast from 'react-hot-toast';
import CreatableSelect from 'react-select/creatable';

import { createTransaction } from '@/app/actions';
import { PAYMENT_METHOD_LABELS, SELECTABLE_PAYMENT_METHODS, type SelectablePaymentMethod } from '@/lib/payment-methods';
import { queueTransactionMutation } from '@/lib/outbox-sync';

type Category = {
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: string | null;
    color: string | null;
};

type Account = {
    id: string;
    name: string;
    type: string;
    institution?: string | null;
    defaultPaymentMethod?: 'cash' | 'card' | 'transfer' | 'bank_transfer' | 'account_transfer' | 'other' | null;
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

function getCategoryIcon(category: Category) {
    if (category.icon && category.icon.trim().length > 0) {
        return category.icon;
    }
    return category.type === 'income' ? '💵' : '💳';
}

type Props = {
    categories: Category[];
    accounts: Account[];
    payees?: string[];
};

export function CreateTransactionForm({ categories, accounts, payees = [] }: Props) {
    const defaultDate = useMemo(() => {
        const now = new Date();
        return now.toISOString().slice(0, 10);
    }, []);

    const formRef = useRef<HTMLFormElement>(null);
    const [state, formAction] = useActionState(
        createTransaction,
        INITIAL_STATE,
    );
    const [activeType, setActiveType] = useState<'income' | 'expense'>('expense');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<SelectablePaymentMethod>('card');
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurringFrequency, setRecurringFrequency] = useState<'monthly' | 'weekly' | 'daily' | 'yearly'>('monthly');
    const [recurringStartDate, setRecurringStartDate] = useState(defaultDate);
    const [recurringAutoLog, setRecurringAutoLog] = useState(true);
    const defaultAccountId = accounts[0]?.id ?? '';
    const [selectedAccountId, setSelectedAccountId] = useState(defaultAccountId);
    const [accountManuallySelected, setAccountManuallySelected] = useState(false);
    const [payeeValue, setPayeeValue] = useState<string>('');
    const [payeeReady, setPayeeReady] = useState(false);
    const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!state.ok) {
            if (state.errors && Object.keys(state.errors).length) {
                const first = Object.values(state.errors)[0]?.[0];
                if (first) {
                    toast.error(first);
                }
            }
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
            setSelectedAccountId('');
            setAccountManuallySelected(false);
            setPayeeValue('');
            setIsRecurring(false);
            setRecurringFrequency('monthly');
            setRecurringStartDate(defaultDate);
            setRecurringAutoLog(true);
            toast.success('Transaction recorded');
        }, 0);

        return () => window.clearTimeout(timeout);
    }, [state, categories, defaultAccountId, defaultDate]);

    useEffect(() => {
        // Avoid SSR/CSR mismatch for react-select.
        const id = window.requestAnimationFrame(() => setPayeeReady(true));
        return () => window.cancelAnimationFrame(id);
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

    const payeeOptions = useMemo(() => {
        const unique = Array.from(new Set(payees.filter((name): name is string => Boolean(name))));
        return unique.map((name) => ({ value: name, label: name }));
    }, [payees]);

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

    const validateClient = useCallback(() => {
        const errors: Record<string, string> = {};
        const amount = Number(formRef.current?.amount?.value ?? 0);
        if (Number.isNaN(amount) || amount <= 0) {
            errors.amount = 'Enter an amount greater than zero.';
        }
        if (!selectedCategory) {
            errors.category_id = 'Pick a category.';
        }
        setLocalErrors(errors);
        if (Object.keys(errors).length) {
            toast.error(Object.values(errors)[0] ?? 'Please fix the errors.');
        }
        return Object.keys(errors).length === 0;
    }, [selectedCategory]);

    const handleSubmit = useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (!validateClient()) {
                return;
            }
            const formData = new FormData(event.currentTarget);
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                queueTransactionMutation({ type: 'create', data: Object.fromEntries(formData.entries()) });
                toast.success('Saved offline — will sync when online');
                event.currentTarget.reset();
                setSelectedCategory('');
                setPaymentMethod('card');
                setSelectedAccountId('');
                setAccountManuallySelected(false);
                setIsRecurring(false);
                setRecurringFrequency('monthly');
                setRecurringStartDate(defaultDate);
                setRecurringAutoLog(true);
                return;
            }
            startTransition(() => {
                formAction(formData);
            });
        },
        [formAction, validateClient, defaultDate],
    );

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

    const linkedAccountId = useMemo(() => {
        const match = accounts.find((account) => account.defaultPaymentMethod === paymentMethod);
        return match?.id ?? '';
    }, [accounts, paymentMethod]);

    const resolvedAccountId =
        accountManuallySelected
            ? selectedAccountId
            : linkedAccountId || selectedAccountId || defaultAccountId;

    return (
        <form
            ref={formRef}
            action={formAction}
            onSubmit={handleSubmit}
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
                ) : localErrors.amount ? (
                    <p className="text-xs text-red-500">{localErrors.amount}</p>
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
                                    className={`rounded-full px-3 py-1 transition ${isActive
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'hover:text-slate-700'
                                        } ${!tab.count
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
                                        className={`flex h-full items-center gap-3 rounded-xl border p-3 text-sm font-semibold shadow-sm transition ${isSelected
                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                                            : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-600'
                                            }`}
                                    >
                                        <span className="text-lg" aria-hidden>
                                            {icon}
                                        </span>
                                        <span className="text-xs">
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
                ) : localErrors.category_id ? (
                    <p className="text-xs text-red-500">{localErrors.category_id}</p>
                ) : null}
            </div>

            <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-800">
                    Payment method
                </p>
                <div className="flex flex-wrap gap-2">
                    {SELECTABLE_PAYMENT_METHODS.map((value) => {
                        const label = PAYMENT_METHOD_LABELS[value];
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
                                    onChange={() => {
                                        setPaymentMethod(value);
                                        setAccountManuallySelected(false);
                                    }}
                                />
                                {label}
                            </label>
                        );
                    })}
                </div>
                {state.errors?.payment_method?.length ? (
                    <p className="text-xs text-red-500">
                        {state.errors.payment_method[0]}
                    </p>
                ) : null}
            </div>

            <div className="grid gap-2">
                <label className="text-sm font-semibold text-slate-800">
                    Payee / merchant
                </label>
                {payeeReady ? (
                    <CreatableSelect
                        instanceId="payee-select"
                        classNamePrefix="payee-select"
                        placeholder="Search or create"
                        value={payeeValue ? { value: payeeValue, label: payeeValue } : null}
                        onChange={(option) => setPayeeValue(option?.value ?? '')}
                        onCreateOption={(value) => setPayeeValue(value)}
                        options={payeeOptions}
                        isClearable
                    />
                ) : (
                    <div className="h-[46px] rounded-xl border border-slate-200 bg-slate-100" />
                )}
                <input type="hidden" name="payee" value={payeeValue} />
                {state.errors?.payee?.length ? (
                    <p className="text-xs text-red-500">{state.errors.payee[0]}</p>
                ) : null}
            </div>

            <div className="grid gap-2">
                <label className="text-sm font-semibold text-slate-800">
                    Account (optional)
                </label>
                <select
                    name="account_id"
                    value={resolvedAccountId}
                    onChange={(event) => {
                        setSelectedAccountId(event.target.value);
                        setAccountManuallySelected(true);
                    }}
                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                >
                    {/* <option value="">No account</option> */}
                    {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                            {account.name}
                        </option>
                    ))}
                </select>
                {state.errors?.account_id?.length ? (
                    <p className="text-xs text-red-500">{state.errors.account_id[0]}</p>
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

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <input
                    type="checkbox"
                    name="recurring_enabled"
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={isRecurring}
                    onChange={(event) => setIsRecurring(event.target.checked)}
                />
                Make this a recurring transaction
            </label>

            {isRecurring ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1">
                        <label className="text-sm font-semibold text-slate-800">Next run date</label>
                        <input
                            type="date"
                            name="recurring_first_run_on"
                            value={recurringStartDate}
                            onChange={(event) => setRecurringStartDate(event.target.value)}
                            className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                        />
                    </div>
                    <div className="grid gap-1">
                        <label className="text-sm font-semibold text-slate-800">Frequency</label>
                        <select
                            name="recurring_frequency"
                            value={recurringFrequency}
                            onChange={(event) =>
                                setRecurringFrequency(
                                    event.target.value as 'monthly' | 'weekly' | 'daily' | 'yearly',
                                )
                            }
                            className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                        >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                        </select>
                    </div>
                    <div className="sm:col-span-2">
                        <input type="hidden" name="recurring_auto_log" value={recurringAutoLog ? 'on' : 'off'} />
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <input
                                type="checkbox"
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                checked={recurringAutoLog}
                                onChange={(event) => setRecurringAutoLog(event.target.checked)}
                            />
                            Auto-log this entry on the due date
                        </label>
                    </div>
                </div>
            ) : null}

            {state.ok ? (
                <p className="text-xs font-medium text-emerald-600">
                    Transaction saved successfully.
                </p>
            ) : null}

            <SubmitButton />
        </form>
    );
}
