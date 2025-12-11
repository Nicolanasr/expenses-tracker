"use client";

import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";

import type { BudgetRow } from "@/lib/budgets";
import { fromCents } from "@/lib/money";
import { queueBudgetMutation } from "@/lib/outbox-sync";

import { deleteBudgetAction, saveBudgetsAction, saveBudgetThresholdsAction } from "./actions";

type Category = {
    id: string;
    name: string;
};
type ThresholdMap = Record<string, number[]>;

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
    initialThresholds,
}: {
    month: string;
    categories: Category[];
    summary: BudgetRow[];
    categorySpend: Record<string, number>;
    cycleLabel: string;
    currencyCode: string;
    initialThresholds: ThresholdMap;
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
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [thresholdDrafts, setThresholdDrafts] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        categories.forEach((cat) => {
            const levels = initialThresholds[cat.id];
            initial[cat.id] = levels?.length ? levels.join(", ") : "50, 75, 90";
        });
        return initial;
    });

    useEffect(() => {
        const reset: Record<string, string> = {};
        summary.forEach((row) => {
            reset[row.category_id] = fromCents(row.budget_cents ?? 0);
        });
        setDrafts(reset);
        const nextThresholds: Record<string, string> = {};
        categories.forEach((cat) => {
            const levels = initialThresholds[cat.id];
            nextThresholds[cat.id] = levels?.length ? levels.join(", ") : "50, 75, 90";
        });
        setThresholdDrafts(nextThresholds);
        setBanner(null);
    }, [month, summary, categories, initialThresholds]);

    const summaryMap = new Map(summary.map((row) => [row.category_id, row]));
    const hasCategories = categories.length > 0;
    let totalBudgetCents = 0;
    let totalSpentCents = 0;
    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
    });

    const handleDelete = (categoryId: string) => {
        if (!categoryId) return;
        const confirmed = confirm("Remove this budget? This only deletes the amount for this month.");
        if (!confirmed) return;
        if (typeof navigator !== "undefined" && !navigator.onLine) {
            toast.error("Go online to delete budgets.");
            return;
        }
        const form = new FormData();
        form.append("categoryId", categoryId);
        form.append("month", month);
        setDeletingId(categoryId);
        startTransition(async () => {
            try {
                await deleteBudgetAction(form);
                setDrafts((prev) => {
                    const next = { ...prev };
                    delete next[categoryId];
                    return next;
                });
                setBanner("Budget deleted.");
                toast.success("Budget deleted");
            } catch (error) {
                console.error(error);
                toast.error("Unable to delete budget");
            } finally {
                setDeletingId(null);
            }
        });
    };

    return (
        <>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                {isPending ? (
                    <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
                        Saving budgets…
                    </div>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">Monthly budgets</h2>
                        <p className="text-xs text-slate-500">Cycle: {cycleLabel}</p>
                    </div>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            startTransition(async () => {
                                try {
                                    const items = categories.map((category) => {
                                        const input = (event.currentTarget as HTMLFormElement).elements.namedItem(`amount-${category.id}`) as HTMLInputElement | null;
                                        return {
                                            categoryId: category.id,
                                            amount: Number(input?.value ?? drafts[category.id] ?? '0'),
                                        };
                                    });
                                    const invalid = items.find((item) => Number.isNaN(item.amount) || item.amount < 0);
                                    if (invalid) {
                                        toast.error('Budget amounts must be zero or greater.');
                                        return;
                                    }
                                    const payload = { month, items };
                                    if (typeof navigator !== 'undefined' && !navigator.onLine) {
                                        await queueBudgetMutation(payload);
                                        toast.success('Queued offline — will sync when online');
                                        setBanner('Queued for sync');
                                        return;
                                    }

                                    const bulk = new FormData();
                                    bulk.append('payload', JSON.stringify(payload));
                                    await saveBudgetsAction(bulk);
                                    const thresholdsPayload = new FormData();
                                    thresholdsPayload.append(
                                        "payload",
                                        JSON.stringify({
                                            items: categories.map((cat) => ({
                                                categoryId: cat.id,
                                                levels: parseLevels(thresholdDrafts[cat.id]),
                                            })),
                                        }),
                                    );
                                    await saveBudgetThresholdsAction(thresholdsPayload);
                                    setBanner('Budgets and alerts saved.');
                                    toast.success('Budgets and alerts saved');
                                } catch {
                                    toast.error('Unable to save budgets/alerts');
                                }
                            });
                        }}
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
                    <div className="mt-5 overflow-auto rounded-2xl border border-slate-100 -mx-5">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-3 py-2 text-left">Category</th>
                                    <th className="px-3 py-2 text-right">Budget</th>
                                    <th className="px-3 py-2 text-right">Spent</th>
                                    <th className="px-3 py-2 text-right">Remaining</th>
                                    <th className="px-3 py-2 text-left">% Used</th>
                                    <th className="px-3 py-2 text-left">Alerts (%)</th>
                                    <th className="px-3 py-2 text-right">Actions</th>
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

                                    totalBudgetCents += budgetCents;
                                    totalSpentCents += spentCents;

                                    const canDelete = Boolean(row);
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
                                            <td className="px-3 py-3">
                                                <input
                                                    name={`alerts-${category.id}`}
                                                    value={thresholdDrafts[category.id] ?? ""}
                                                    onChange={(event) =>
                                                        setThresholdDrafts((prev) => ({
                                                            ...prev,
                                                            [category.id]: event.target.value,
                                                        }))
                                                    }
                                                    className="w-32 rounded-xl border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                    placeholder="50,75,90"
                                                />
                                                <p className="text-[11px] text-slate-500">Comma-separated %</p>
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                {canDelete ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(category.id)}
                                                        disabled={isPending || deletingId === category.id}
                                                        className="text-xs font-semibold text-rose-600 transition hover:text-rose-500 disabled:opacity-50"
                                                    >
                                                        {deletingId === category.id ? 'Removing…' : 'Delete'}
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
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

function parseLevels(input: string | undefined): number[] {
    if (!input) return [];
    return Array.from(
        new Set(
            input
                .split(",")
                .map((part) => Number(part.trim()))
                .filter((n) => Number.isFinite(n) && n > 0 && n <= 100)
                .map((n) => Math.round(n)),
        ),
    ).sort((a, b) => a - b);
}
