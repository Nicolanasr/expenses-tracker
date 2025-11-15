"use client";

import { useEffect, useState, useTransition } from "react";

import type { BudgetRow } from "@/lib/budgets";
import { fromCents } from "@/lib/money";

import { saveBudgetsAction } from "./actions";

type Category = {
    id: string;
    name: string;
};

function pctColor(pct: number) {
    if (pct >= 90) return "bg-rose-500";
    if (pct >= 70) return "bg-amber-500";
    return "bg-emerald-500";
}

function BudgetBar({ pct }: { pct: number }) {
    return (
        <div className="h-2 w-full rounded-full bg-slate-100">
            <div className={`h-2 rounded-full ${pctColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
    );
}

export default function BudgetTable({
    month,
    categories,
    summary,
    categorySpend,
    cycleLabel,
    currencyCode,
}: {
    month: string;
    categories: Category[];
    summary: BudgetRow[];
    categorySpend: Record<string, number>;
    cycleLabel: string;
    currencyCode: string;
}) {
    const [isPending, startTransition] = useTransition();
    const [drafts, setDrafts] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        summary.forEach((row) => {
            initial[row.category_id] = fromCents(row.budget_cents ?? 0);
        });
        return initial;
    });
    const [banner, setBanner] = useState<string | null>(null);

    useEffect(() => {
        const reset: Record<string, string> = {};
        summary.forEach((row) => {
            reset[row.category_id] = fromCents(row.budget_cents ?? 0);
        });
        setDrafts(reset);
        setBanner(null);
    }, [month, summary]);

    const summaryMap = new Map(summary.map((row) => [row.category_id, row]));
    const hasCategories = categories.length > 0;
    let totalBudgetCents = 0;
    let totalSpentCents = 0;
    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
    });

    return (
        <>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">Monthly budgets</h2>
                        <p className="text-xs text-slate-500">Cycle: {cycleLabel}</p>
                    </div>
                    <form
                        action={(formData: FormData) =>
                            startTransition(async () => {
                                const payload = {
                                    month,
                                    items: categories.map((category) => ({
                                        categoryId: category.id,
                                        amount: Number(formData.get(`amount-${category.id}`) ?? drafts[category.id] ?? '0'),
                                    })),
                                };

                                const bulk = new FormData();
                                bulk.append('payload', JSON.stringify(payload));
                                await saveBudgetsAction(bulk);
                                setBanner('Budgets saved.');
                            })
                        }
                        className="flex items-center gap-2"
                    >
                        <button
                            type="submit"
                            disabled={isPending}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Save all
                        </button>
                    </form>
                </div>
                {banner ? <p className="mt-2 text-xs font-medium text-emerald-600">{banner}</p> : null}

                {!hasCategories ? (
                    <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                        Add a few categories first so you can set monthly budgets.
                    </p>
                ) : (
                    <div className="mt-5 overflow-auto rounded-2xl border border-slate-100">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-3 py-2 text-left">Category</th>
                                    <th className="px-3 py-2 text-right">Budget</th>
                                    <th className="px-3 py-2 text-right">Spent</th>
                                    <th className="px-3 py-2 text-right">Remaining</th>
                                    <th className="px-3 py-2 text-left">% Used</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map((category) => {
                                    const row = summaryMap.get(category.id);
                                    const budgetCents = row?.budget_cents ?? 0;
                                    const fallbackSpent = categorySpend?.[category.id] ?? 0;
                                    const spentCents = row?.spent_cents ?? fallbackSpent;
                                    const remainingCents = row?.remaining_cents ?? budgetCents - spentCents;
                                    const usedPct =
                                        row?.used_pct ??
                                        (budgetCents === 0 ? 0 : Number(((spentCents / budgetCents) * 100).toFixed(1)));

                                    // eslint-disable-next-line react-hooks/immutability
                                    totalBudgetCents += budgetCents;
                                    totalSpentCents += spentCents;

                                    return (
                                        <tr key={category.id} className="border-t border-slate-100">
                                            <td className="px-3 py-3 font-medium text-slate-900">{category.name}</td>
                                            <td className="px-3 py-3">
                                                <input
                                                    name={`amount-${category.id}`}
                                                    value={drafts[category.id] ?? fromCents(budgetCents)}
                                                    onChange={(event) =>
                                                        setDrafts((prev) => ({
                                                            ...prev,
                                                            [category.id]: event.target.value,
                                                        }))
                                                    }
                                                    inputMode="decimal"
                                                    className="w-24 rounded-xl border border-slate-200 px-3 py-1 text-right text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                />
                                            </td>
                                            <td className="px-3 py-3 text-right font-mono text-sm text-slate-700">
                                                {fromCents(spentCents)}
                                            </td>
                                            <td className="px-3 py-3 text-right font-mono text-sm text-slate-700">
                                                {fromCents(remainingCents)}
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs font-semibold text-slate-600">{usedPct.toFixed(1)}%</span>
                                                    <BudgetBar pct={usedPct} />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {isPending ? <p className="mt-3 text-xs text-slate-500">Updating budgets…</p> : null}

            </div>

            <div className="sticky bottom-4 mt-6">
                <div className="rounded-2xl border border-slate-900/10 bg-slate-900 text-white shadow-xl shadow-slate-900/10">
                    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Spent vs budget</p>
                            <p className="text-lg font-semibold">
                                {currencyFormatter.format(Math.max(totalSpentCents, 0) / 100)} /{" "}
                                {currencyFormatter.format(Math.max(totalBudgetCents, 0) / 100)}
                            </p>
                        </div>
                        <div className="w-full sm:w-60">
                            <BudgetBar
                                pct={totalBudgetCents === 0 ? 0 : Math.min(100, (totalSpentCents / totalBudgetCents) * 100)}
                            />
                            <p className="mt-1 text-right text-xs text-white/70">
                                {totalBudgetCents === 0
                                    ? "No planned budget"
                                    : `${((totalSpentCents / totalBudgetCents) * 100).toFixed(1)}% used`}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
