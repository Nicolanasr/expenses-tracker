'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';

import {
    deleteTransaction,
    type FormState,
    updateTransaction,
} from '@/app/actions';
import { MdDelete, MdModeEdit } from 'react-icons/md';

const DATE = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
});

const PAYMENT_METHOD_LABELS = {
    card: 'Card',
    cash: 'Cash',
    transfer: 'Bank transfer',
    other: 'Other',
} as const;

type CategoryOption = {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    type: 'income' | 'expense';
};

type TransactionData = {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  occurredOn: string;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'other';
  notes: string | null;
  categoryId: string | null;
  category: CategoryOption | null;
  currencyCode: string;
};

type TransactionItemProps = {
  transaction: TransactionData;
  categories: CategoryOption[];
  enableEditing?: boolean;
};

const EDIT_INITIAL_STATE: FormState = { ok: false, errors: {} };

function TransactionEditForm({
    transaction,
    categories,
    onCancel,
}: {
    transaction: TransactionData;
    categories: CategoryOption[];
    onCancel: () => void;
}) {
    const [state, formAction] = useActionState<FormState, FormData>(
        updateTransaction,
        EDIT_INITIAL_STATE,
    );
    const [paymentMethod, setPaymentMethod] = useState<
        keyof typeof PAYMENT_METHOD_LABELS
    >(transaction.paymentMethod);

    useEffect(() => {
        if (state.ok) {
            onCancel();
        }
    }, [state.ok, onCancel]);

    const groupedCategories = useMemo(() => {
        return categories.reduce<Record<'income' | 'expense', CategoryOption[]>>(
            (acc, category) => {
                acc[category.type].push(category);
                return acc;
            },
            { income: [], expense: [] },
        );
    }, [categories]);

    const hasExpenses = groupedCategories.expense.length > 0;
    const hasIncome = groupedCategories.income.length > 0;

    return (
        <form action={formAction} className="space-y-4">
            <input type="hidden" name="id" value={transaction.id} />
            <div className="grid gap-2">
                <label className="text-sm font-semibold text-slate-900">
                    Amount
                </label>
                <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={transaction.amount}
                    required
                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                />
                {state.errors?.amount?.length ? (
                    <p className="text-xs text-red-500">{state.errors.amount[0]}</p>
                ) : null}
            </div>

            <div className="grid gap-2">
                <label className="text-sm font-semibold text-slate-900">
                    Date
                </label>
                <input
                    name="occurred_on"
                    type="date"
                    defaultValue={transaction.occurredOn.slice(0, 10)}
                    required
                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                />
                {state.errors?.occurred_on?.length ? (
                    <p className="text-xs text-red-500">
                        {state.errors.occurred_on[0]}
                    </p>
                ) : null}
            </div>

            <div className="grid gap-2">
                <label className="text-sm font-semibold text-slate-900">
                    Category
                </label>
                <select
                    name="category_id"
                    defaultValue={transaction.categoryId ?? ''}
                    required
                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                >
                    <option value="" disabled>
                        Select a category
                    </option>
                    {hasExpenses ? (
                        <optgroup label="Expenses">
                            {groupedCategories.expense.map((category) => (
                                <option value={category.id} key={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </optgroup>
                    ) : null}
                    {hasIncome ? (
                        <optgroup label="Income">
                            {groupedCategories.income.map((category) => (
                                <option value={category.id} key={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </optgroup>
                    ) : null}
                </select>
                {state.errors?.category_id?.length ? (
                    <p className="text-xs text-red-500">{state.errors.category_id[0]}</p>
                ) : null}
            </div>

            <div className="grid gap-2">
                <p className="text-sm font-semibold text-slate-900">Payment method</p>
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

            <div className="grid gap-2">
                <label className="text-sm font-semibold text-slate-900">
                    Notes
                </label>
                <textarea
                    name="notes"
                    rows={3}
                    defaultValue={transaction.notes ?? ''}
                    placeholder="Add context"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                />
                {state.errors?.notes?.length ? (
                    <p className="text-xs text-red-500">{state.errors.notes[0]}</p>
                ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                >
                    Cancel
                </button>
                <EditSubmitButton />
            </div>
        </form>
    );
}

function EditSubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={pending}
        >
            {pending ? 'Saving…' : 'Save changes'}
        </button>
    );
}

function DeleteTransactionButton({ transactionId }: { transactionId: string }) {
    return (
        <form action={deleteTransaction} className="inline">
            <input type="hidden" name="id" value={transactionId} />
            <DeleteSubmitButton />
        </form>
    );
}

function DeleteSubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full border border-red-200 p-2 text-red-600 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={pending}
            onClick={(event) => {
                if (!window.confirm('Delete this transaction?')) {
                    event.preventDefault();
                }
            }}
            aria-label="Delete transaction"
            title="Delete transaction"
        >
            {pending ? '⌛' : <MdDelete />}
        </button>
    );
}

export function TransactionItem({
 transaction,
 categories,
 enableEditing = false,
}: TransactionItemProps) {
 const [isEditing, setIsEditing] = useState(false);
  const amountFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: transaction.currencyCode,
      }),
    [transaction.currencyCode],
  );

    return (
        <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            {enableEditing && isEditing ? (
                <TransactionEditForm
                    transaction={transaction}
                    categories={categories}
                    onCancel={() => setIsEditing(false)}
                />
            ) : (
                <>
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-lg font-semibold"
                                style={{
                                    color: transaction.category?.color ?? '#4f46e5',
                                    borderColor: transaction.category?.color ?? '#c7d2fe',
                                }}
                                aria-hidden
                            >
                                {transaction.category?.icon ?? '🏷️'}
                            </span>
                            <div className="flex flex-col">
                                <p className="text-sm font-semibold text-slate-900">
                                    {transaction.category?.name ?? 'Uncategorised'}
                                </p>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {PAYMENT_METHOD_LABELS[transaction.paymentMethod]}
                                </p>
                                <p className="text-xs font-medium text-slate-500">
                                    {DATE.format(new Date(transaction.occurredOn))}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {enableEditing ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(true)}
                                        className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                        aria-label="Edit transaction"
                                        title="Edit transaction"
                                    >
                                        <MdModeEdit />
                                    </button>
                                    <DeleteTransactionButton transactionId={transaction.id} />
                                </>
                            ) : null}
                        </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-600">
                            {transaction.type === 'income' ? 'Income' : 'Expense'}
                        </span>
                        <span
                            className={`text-sm font-semibold ${transaction.type === 'income'
                                ? 'text-emerald-600'
                                : 'text-rose-600'
                                }`}
                        >
              {transaction.type === 'income' ? '+' : '-'}
              {amountFormatter.format(Number(transaction.amount))}
            </span>
                    </div>
                    {transaction.notes ? (
                        <p className="mt-3 text-xs font-medium text-slate-600">
                            {transaction.notes}
                        </p>
                    ) : null}
                </>
            )}
        </article>
    );
}
