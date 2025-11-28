'use client';

import { useEffect, useMemo, useState } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import toast from 'react-hot-toast';
import { createTransferAction, type TransferFormState } from '@/app/transfers/actions';

const INITIAL_STATE: TransferFormState = { ok: false };

type AccountSummary = {
    id: string;
    name: string;
    type: string;
    balance: number;
};

type QuickAction = {
    label: string;
    fromId: string;
    toId: string;
};

type Props = {
    accounts: AccountSummary[];
    quickActions: QuickAction[];
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={pending}
        >
            {pending ? 'Recording…' : 'Record transfer'}
        </button>
    );
}

export function TransferForm({ accounts, quickActions }: Props) {
    const [state, formAction] = useActionState<TransferFormState, FormData>(createTransferAction, INITIAL_STATE);
    const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id ?? '');
    const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? '');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState('');

    const fromAccount = accounts.find((account) => account.id === fromAccountId) ?? null;

    const insufficient = useMemo(() => {
        const parsed = Number(amount);
        if (!fromAccount) return false;
        if (Number.isNaN(parsed) || parsed <= 0) return false;
        return parsed > fromAccount.balance;
    }, [amount, fromAccount]);

    const handleQuickAction = (action: QuickAction) => {
        setFromAccountId(action.fromId);
        setToAccountId(action.toId);
    };

    useEffect(() => {
        if (state.ok) {
            toast.success('Transfer completed');
        } else if (state.message && !state.ok) {
            toast.error(state.message);
        }
    }, [state.ok, state.message]);

    if (accounts.length < 2) {
        return (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-600">Add at least two accounts to start transferring.</p>
            </section>
        );
    }

    return (
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="space-y-1">
                <h1 className="text-xl font-semibold text-slate-900">Transfer between accounts</h1>
                <p className="text-sm text-slate-500">Move money without creating two manual transactions.</p>
            </div>

            {quickActions.length ? (
                <div className="flex flex-wrap gap-2">
                    {quickActions.map((action) => (
                        <button
                            key={action.label}
                            type="button"
                            onClick={() => handleQuickAction(action)}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
                        >
                            {action.label}
                        </button>
                    ))}
                </div>
            ) : null}

            <form action={formAction} className="grid gap-4">
                <div className="grid gap-2 md:grid-cols-2">
                    <div className="grid gap-1">
                        <label className="text-sm font-semibold text-slate-900">From account</label>
                        <select
                            name="from_account_id"
                            value={fromAccountId}
                            onChange={(event) => setFromAccountId(event.target.value)}
                            className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                        >
                            {accounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                    {account.name} ({account.balance.toFixed(2)})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="grid gap-1">
                        <label className="text-sm font-semibold text-slate-900">To account</label>
                        <select
                            name="to_account_id"
                            value={toAccountId}
                            onChange={(event) => setToAccountId(event.target.value)}
                            className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                        >
                            {accounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                    {account.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                {state.message && !state.ok ? (
                    <p className="text-xs text-red-500">{state.message}</p>
                ) : null}
                <div className="grid gap-2 md:grid-cols-2">
                    <div className="grid gap-1">
                        <label className="text-sm font-semibold text-slate-900">Amount</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            name="amount"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                            required
                        />
                        {insufficient && fromAccount ? (
                            <p className="text-xs text-rose-600">Available {fromAccount.balance.toFixed(2)}</p>
                        ) : null}
                    </div>
                    <div className="grid gap-1">
                        <label className="text-sm font-semibold text-slate-900">Date</label>
                        <input
                            type="date"
                            name="occurred_on"
                            value={date}
                            onChange={(event) => setDate(event.target.value)}
                            className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                            required
                        />
                    </div>
                </div>
                <div className="grid gap-1">
                    <label className="text-sm font-semibold text-slate-900">Notes (optional)</label>
                    <textarea
                        name="notes"
                        rows={3}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
                        placeholder="For example: Monthly savings" 
                    />
                </div>
                <SubmitButton />
            </form>
        </section>
    );
}
