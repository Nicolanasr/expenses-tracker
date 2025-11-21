"use client";

import { useActionState, useState } from "react";
import { HiOutlineBanknotes, HiOutlineTrash, HiOutlinePencilSquare } from "react-icons/hi2";

import { createAccountAction, deleteAccountAction, updateAccountAction, type AccountFormState } from "@/app/account/actions";

const ACCOUNT_TYPES = [
    { value: 'cash', label: 'Cash' },
    { value: 'checking', label: 'Checking' },
    { value: 'savings', label: 'Savings' },
    { value: 'credit', label: 'Credit card' },
    { value: 'investment', label: 'Investment' },
    { value: 'other', label: 'Other' },
] as const;

type Account = {
    id: string;
    name: string;
    type: string;
    institution: string | null;
    startingBalance: number;
    balance: number;
    defaultPaymentMethod?: 'cash' | 'card' | 'transfer' | 'other' | null;
};

const INITIAL_STATE: AccountFormState = { ok: false };

export function AccountsManager({ accounts }: { accounts: Account[] }) {
    const [state, formAction] = useActionState<AccountFormState, FormData>(createAccountAction, INITIAL_STATE);
    const [deleteState, deleteAction] = useActionState<AccountFormState, FormData>(deleteAccountAction, INITIAL_STATE);
    const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
    const [editState, editAction] = useActionState<AccountFormState, FormData>(
        async (_prev, formData) => {
            const result = await updateAccountAction(_prev, formData);
            if (result.ok) {
                setEditingAccountId(null);
            }
            return result;
        },
        INITIAL_STATE,
    );

    return (
        <section className="space-y-6">
            <div className="space-y-2">
                <h2 className="text-xl font-semibold text-slate-900">Accounts</h2>
                <p className="text-sm text-slate-500">
                    Tag transactions with the accounts you track. Link a payment method so new transactions auto-select the correct account.
                </p>
            </div>

            <form action={formAction} className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid gap-2">
                    <label className="text-sm font-semibold text-slate-900">Account name</label>
                    <input
                        type="text"
                        name="name"
                        required
                        className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                        placeholder="e.g. Main checking"
                    />
                    {state.errors?.name?.length ? <p className="text-xs text-red-500">{state.errors.name[0]}</p> : null}
                </div>
            <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-2">
                    <label className="text-sm font-semibold text-slate-900">Type</label>
                    <select
                        name="type"
                            className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                            defaultValue="cash"
                        >
                            {ACCOUNT_TYPES.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="grid gap-2">
                    <label className="text-sm font-semibold text-slate-900">Starting balance</label>
                    <input
                        type="number"
                        name="starting_balance"
                        step="0.01"
                        min={0}
                        defaultValue="0"
                        className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                    />
                </div>
            </div>
            <div className="grid gap-2">
                <label className="text-sm font-semibold text-slate-900">Link payment method</label>
                <select
                    name="default_payment_method"
                    className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                    defaultValue=""
                >
                    <option value="">None</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="transfer">Transfer</option>
                    <option value="other">Other</option>
                </select>
            </div>
                <div className="grid gap-2">
                    <label className="text-sm font-semibold text-slate-900">Institution (optional)</label>
                    <input
                        type="text"
                        name="institution"
                        className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                        placeholder="Bank or provider"
                    />
                </div>
                <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                >
                    Add account
                </button>
                {state.message && !state.ok ? (
                    <p className="text-xs text-red-500">{state.message}</p>
                ) : null}
            </form>

            <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">Your accounts</p>
                {accounts.length === 0 ? (
                    <p className="text-sm text-slate-500">No accounts yet. Transactions with no account stay uncategorized.</p>
                ) : (
                    <ul className="space-y-3">
                        {accounts.map((account) => (
                            <li
                                key={account.id}
                                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="rounded-full bg-indigo-50 p-2 text-indigo-600">
                                        <HiOutlineBanknotes className="h-5 w-5" />
                                    </span>
                                    <div>
                                        <p className="text-base font-semibold text-slate-900">{account.name}</p>
                                        <p className="text-xs uppercase tracking-wide text-slate-500">{account.type}</p>
                                        {account.institution ? (
                                            <p className="text-xs text-slate-500">{account.institution}</p>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="flex flex-col items-start gap-2 text-sm font-medium text-slate-900 sm:items-end">
                                    <p>Balance: {account.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                                    {editingAccountId === account.id ? (
                                        <form action={editAction} className="space-y-2 w-full sm:w-64">
                                            <input type="hidden" name="account_id" value={account.id} />
                                            <div className="grid gap-1">
                                                <input
                                                    type="text"
                                                    name="name"
                                                    defaultValue={account.name}
                                                    className="h-9 rounded-lg border border-slate-300 px-2 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                                                />
                                                {editState.errors?.name?.length ? (
                                                    <p className="text-xs text-red-500">{editState.errors.name[0]}</p>
                                                ) : null}
                                            </div>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                <select
                                                    name="type"
                                                    defaultValue={account.type}
                                                    className="h-9 rounded-lg border border-slate-300 px-2 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                                                >
                                                    {ACCOUNT_TYPES.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="number"
                                                    name="starting_balance"
                                                    step="0.01"
                                                    defaultValue={account.startingBalance}
                                                    className="h-9 rounded-lg border border-slate-300 px-2 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                name="institution"
                                                defaultValue={account.institution ?? ''}
                                                placeholder="Institution"
                                                className="h-9 rounded-lg border border-slate-300 px-2 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                                            />
                                            <select
                                                name="default_payment_method"
                                                defaultValue={account.defaultPaymentMethod ?? ''}
                                                className="h-9 rounded-lg border border-slate-300 px-2 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                                            >
                                                <option value="">No link</option>
                                                <option value="cash">Cash</option>
                                                <option value="card">Card</option>
                                                <option value="transfer">Transfer</option>
                                                <option value="other">Other</option>
                                            </select>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="submit"
                                                    className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    type="button"
                                                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                                                    onClick={() => setEditingAccountId(null)}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                            {editState.message && !editState.ok && editingAccountId === account.id ? (
                                                <p className="text-xs text-red-500">{editState.message}</p>
                                            ) : null}
                                        </form>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
                                                onClick={() => setEditingAccountId(account.id)}
                                            >
                                                <HiOutlinePencilSquare className="h-4 w-4" />
                                                Edit
                                            </button>
                                            <form action={deleteAction}>
                                                <input type="hidden" name="account_id" value={account.id} />
                                                <button
                                                    type="submit"
                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-500"
                                                    onClick={(event) => {
                                                        if (!confirm(`Delete ${account.name}? Transactions keep their history.`)) {
                                                            event.preventDefault();
                                                        }
                                                    }}
                                                >
                                                    <HiOutlineTrash className="h-4 w-4" />
                                                    Delete
                                                </button>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
                {deleteState.message && !deleteState.ok ? (
                    <p className="text-xs text-red-500">{deleteState.message}</p>
                ) : null}
            </div>
        </section>
    );
}
