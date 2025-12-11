'use client';

import { useState } from 'react';

import { deleteRecurringRuleAction, runRecurringRuleAction, type RecurringFormState } from '@/app/transactions/recurring-actions';
import { PAYMENT_METHOD_LABELS } from '@/lib/payment-methods';

const INITIAL_STATE: RecurringFormState = { ok: false };

export type RecurringRule = {
    id: string;
    name: string;
    amount: number;
    type: 'income' | 'expense';
    paymentMethod: string;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    nextRunOn: string;
    autoLog: boolean;
    notes: string | null;
    categoryName?: string | null;
    accountName?: string | null;
    isDue: boolean;
};

export function RecurringTransactionsPanel({
    rules,
    currencyCode,
}: {
    rules: RecurringRule[];
    currencyCode: string;
}) {
    const [open, setOpen] = useState(false);
    const amountFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode || 'USD',
    });

    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="font-semibold text-slate-900">Recurring transactions</h2>
                        <p className="text-xs text-slate-500">Upcoming schedules that auto-log or require approval.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setOpen((prev) => !prev)}
                        className="whitespace-nowrap rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
                    >
                        {open ? 'Hide history' : `Show history (${rules.length})`}
                    </button>
                </div>


                {open ? (
                    <div className="mt-4 space-y-3">
                        {rules.length === 0 ? (
                            <p className="text-sm text-slate-500">No recurring transactions yet.</p>
                        ) : (
                            rules.map((rule) => (
                                <div
                                    key={rule.id}
                                    className="flex flex-col gap-2 rounded-2xl border border-slate-100 p-4 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div>
                                        <p className="font-semibold text-slate-900">
                                            {rule.name}{' '}
                                            {rule.isDue ? (
                                                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Due</span>
                                            ) : null}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {{
                                                daily: 'Daily',
                                                weekly: 'Weekly',
                                                monthly: 'Monthly',
                                                yearly: 'Yearly',
                                            }[rule.frequency]}{' '}
                                            · next on {new Date(rule.nextRunOn).toLocaleDateString('en-US')}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {amountFormatter.format(rule.amount)} · {rule.type === 'income' ? 'Income' : 'Expense'} ·{' '}
                                            {PAYMENT_METHOD_LABELS[rule.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? 'Method'}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {rule.accountName ? `${rule.accountName}` : 'No account'} · {rule.categoryName ?? 'No category'}
                                        </p>
                                        {rule.notes ? <p className="text-xs text-slate-500">{rule.notes}</p> : null}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {!rule.autoLog && rule.isDue ? (
                                            <form action={async (formData) => { await runRecurringRuleAction(INITIAL_STATE, formData); }}>
                                                <input type="hidden" name="recurring_id" value={rule.id} />
                                                <button
                                                    type="submit"
                                                    className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-600 transition hover:border-emerald-300 hover:text-emerald-700"
                                                >
                                                    Log now
                                                </button>
                                            </form>
                                        ) : null}
                                        <form action={async (formData) => { await deleteRecurringRuleAction(INITIAL_STATE, formData); }}>
                                            <input type="hidden" name="recurring_id" value={rule.id} />
                                            <button
                                                type="submit"
                                                className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:text-rose-700"
                                            >
                                                Delete
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : null}
            </div>
        </section>
    );
}
