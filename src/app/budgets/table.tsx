"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Select from "react-select";
import toast from "react-hot-toast";
import { nanoid } from "nanoid";

import type { BudgetRow } from "@/lib/budgets";
import { fromCents } from "@/lib/money";

import { deleteBudgetAction, saveBudgetsAction, saveBudgetThresholdsAction, upsertBudgetAction } from "./actions";

type Category = { id: string; name: string };
type ThresholdMap = Record<string, number[]>;
type Account = { id: string; name: string; currency_code: string };
type CategoryStats = {
    prevBudgetCents: number;
    prevSpentCents: number;
    prevUsedPct: number;
    minSpendCents: number;
};

type BudgetDraft = {
    id?: string;
    localId: string;
    label: string;
    categoryId: string;
    accountIds: string[];
    amount: string;
    spent: number;
};

type RowErrors = {
    amount?: string;
    category?: string;
};

function normalizeLevels(levels?: number[]) {
    const sanitized = (levels ?? [])
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n))
        .map((n) => Math.min(100, Math.max(1, Math.round(n))));
    return Array.from(new Set(sanitized)).sort((a, b) => a - b);
}

function buildThresholds(categories: Category[], initial: ThresholdMap) {
    const map: Record<string, number[]> = {};
    categories.forEach((cat) => {
        map[cat.id] = normalizeLevels(initial?.[cat.id] ?? [50, 75, 90]);
    });
    return map;
}

function buildDrafts(summary: BudgetRow[], categories: Category[]) {
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    return (summary ?? []).map((row) => ({
        id: row.id,
        localId: row.id ?? nanoid(),
        label: categoryMap.get(row.category_id) ?? row.label ?? "Budget",
        categoryId: row.category_id,
        accountIds: row.account_ids ?? [],
        amount: fromCents(row.budget_cents ?? 0),
        spent: row.spent_cents ?? 0,
    }));
}

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

function StatBadge({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "indigo" | "rose" | "amber" }) {
    const toneClasses =
        tone === "indigo"
            ? "bg-indigo-50 text-indigo-700 border-indigo-100"
            : tone === "rose"
                ? "bg-rose-50 text-rose-700 border-rose-100"
                : tone === "amber"
                    ? "bg-amber-50 text-amber-700 border-amber-100"
                    : "bg-slate-50 text-slate-700 border-slate-100";
    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${toneClasses}`}>
            <span className="uppercase tracking-wide">{label}</span>
            <span>{value}</span>
        </span>
    );
}

export default function BudgetTable({
    month,
    categories,
    summary,
    currencyCode,
    cycleLabel,
    initialThresholds,
    accounts,
    stats,
}: {
    month: string;
    categories: Category[];
    summary: BudgetRow[];
    currencyCode: string;
    cycleLabel: string;
    initialThresholds: ThresholdMap;
    accounts: Account[];
    stats: Record<string, CategoryStats>;
}) {
    const [isPending, startTransition] = useTransition();
    const [banner, setBanner] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({});
    const [isSwitchingCurrency, setIsSwitchingCurrency] = useState(false);
    const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

    const [budgets, setBudgets] = useState<BudgetDraft[]>(() => buildDrafts(summary, categories));
    useEffect(() => {
        setBudgets(buildDrafts(summary, categories));
        setRowErrors({});
        setIsSwitchingCurrency(false);
        setOpenCards(new Set());
    }, [summary, categories, currencyCode]);

    const [thresholdDrafts, setThresholdDrafts] = useState<Record<string, number[]>>(() => buildThresholds(categories, initialThresholds));
    useEffect(() => {
        setThresholdDrafts(buildThresholds(categories, initialThresholds));
    }, [categories, initialThresholds, currencyCode]);
    const [thresholdInputs, setThresholdInputs] = useState<Record<string, string>>({});
    const [openCards, setOpenCards] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (typeof window === "undefined") return;
        const handler = (event: Event) => {
            if (!(event instanceof CustomEvent)) return;
            if (event.detail?.state === "pending") {
                setIsSwitchingCurrency(true);
            }
        };
        window.addEventListener("budget:currency-switch", handler as EventListener);
        return () => window.removeEventListener("budget:currency-switch", handler as EventListener);
    }, []);

    const categoryOptions = categories.map((cat) => ({ value: cat.id, label: cat.name }));
    const accountOptions = useMemo(
        () =>
            accounts
                .filter((acc) => acc.currency_code === currencyCode)
                .map((acc) => ({ value: acc.id, label: acc.name })),
        [accounts, currencyCode],
    );
    const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

    const totalBudgetCents = budgets.reduce((sum, b) => sum + Math.round(Number(b.amount || 0) * 100), 0);
    const totalSpentCents = budgets.reduce((sum, b) => sum + Number(b.spent || 0), 0);
    const currencyFormatter = useMemo(
        () => new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }),
        [currencyCode],
    );
    const isBusy = isPending || isSwitchingCurrency;

    const handleAddBudget = () => {
        const firstCategory = categories[0]?.id ?? "";
        const newBudget: BudgetDraft = {
            localId: nanoid(),
            label: categoryMap.get(firstCategory) ?? "Budget",
            categoryId: firstCategory,
            accountIds: [],
            amount: "0",
            spent: 0,
        };
        setBudgets((prev) => [newBudget, ...prev]);
        setOpenCards((prev) => {
            const next = new Set(prev);
            next.add(newBudget.localId);
            return next;
        });
    };

    const handleGenerateDefaults = () => {
        const existing = new Set(budgets.filter((b) => (b.accountIds ?? []).length === 0).map((b) => b.categoryId));
        const missing = categories.filter((cat) => !existing.has(cat.id));
        if (!missing.length) {
            toast.success("All categories already have budgets.");
            return;
        }
        setSavingId("generate");
        startTransition(async () => {
            try {
                const created: BudgetDraft[] = [];
                for (const cat of missing) {
                    const form = new FormData();
                    form.append("label", categoryMap.get(cat.id) ?? "Budget");
                    form.append("categoryId", cat.id);
                    form.append("month", month);
                    form.append("amount", "0");
                    form.append("currency_code", currencyCode);
                    const result = await upsertBudgetAction(form);
                    if (!result?.ok) {
                        throw new Error(result?.error || "Unable to generate budgets");
                    }
                    created.push({
                        id: result.budgetId,
                        localId: result.budgetId ?? nanoid(),
                        label: categoryMap.get(cat.id) ?? "Budget",
                        categoryId: cat.id,
                        accountIds: [],
                        amount: "0",
                        spent: 0,
                    });
                }
                if (created.length) {
                    setBudgets((prev) => [...prev, ...created]);
                    toast.success(`Generated ${created.length} budgets`);
                }
            } catch (error) {
                console.error(error);
                toast.error("Unable to generate budgets");
            } finally {
                setSavingId(null);
            }
        });
    };

    const addThreshold = (categoryId: string, value: number) => {
        setThresholdDrafts((prev) => {
            const next = prev[categoryId] ?? [];
            const merged = normalizeLevels([...next, value]);
            return { ...prev, [categoryId]: merged };
        });
        setThresholdInputs((prev) => ({ ...prev, [categoryId]: "" }));
    };

    const removeThreshold = (categoryId: string, value: number) => {
        setThresholdDrafts((prev) => ({
            ...prev,
            [categoryId]: (prev[categoryId] ?? []).filter((v) => v !== value),
        }));
    };

    const handleDelete = (budget: BudgetDraft) => {
        if (!budget.id) {
            setBudgets((prev) => prev.filter((b) => b.localId !== budget.localId));
            return;
        }
        if (!confirm("Remove this budget?")) return;
        setDeletingId(budget.id);
        const form = new FormData();
        form.append("budget_id", budget.id);
        startTransition(async () => {
            try {
                await deleteBudgetAction(form);
                setBudgets((prev) => prev.filter((b) => b.id !== budget.id));
                toast.success("Budget deleted");
            } catch (error) {
                console.error(error);
                toast.error("Unable to delete budget");
            } finally {
                setDeletingId(null);
            }
        });
    };

    const handleSaveRow = (budget: BudgetDraft) => {
        if (isBusy) return;
        const errors: RowErrors = {};
        const amountNumber = Number(budget.amount);
        if (!budget.categoryId) {
            errors.category = "Pick a category";
        }
        if (Number.isNaN(amountNumber) || amountNumber < 0) {
            errors.amount = "Enter a valid amount";
        }
        if (errors.amount || errors.category) {
            setRowErrors((prev) => ({ ...prev, [budget.localId]: errors }));
            return;
        }
        setRowErrors((prev) => ({ ...prev, [budget.localId]: {} }));
        const form = new FormData();
        if (budget.id) {
            form.append("id", budget.id);
        }
        form.append("label", categoryMap.get(budget.categoryId) ?? "Budget");
        form.append("categoryId", budget.categoryId);
        form.append("month", month);
        form.append("amount", budget.amount || "0");
        form.append("currency_code", currencyCode);
        budget.accountIds.forEach((id) => form.append("account_ids[]", id));
        setSavingId(budget.localId);
        startTransition(async () => {
            try {
                const result = await upsertBudgetAction(form);
                if (!result?.ok) {
                    const message = result?.error ?? "Unable to save budget";
                    toast.error(message);
                    return;
                }
                setBudgets((prev) =>
                    prev.map((b) => (b.localId === budget.localId ? { ...b, id: result?.budgetId ?? b.id } : b)),
                );
                toast.success("Budget saved");
            } catch (error) {
                console.error(error);
                const message = error instanceof Error ? error.message : "Unable to save budget";
                toast.error(message);
            } finally {
                setSavingId(null);
            }
        });
    };

    const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        startTransition(async () => {
            try {
                const nextErrors: Record<string, RowErrors> = {};
                const budgetPayload = budgets.map((b) => {
                    const amount = Number(b.amount || 0);
                    const errs: RowErrors = {};
                    if (!b.categoryId) errs.category = "Pick a category";
                    if (Number.isNaN(amount) || amount < 0) errs.amount = "Enter a valid amount";
                    if (errs.amount || errs.category) {
                        nextErrors[b.localId] = errs;
                    }
                    return {
                        id: b.id,
                        label: categoryMap.get(b.categoryId) ?? "Budget",
                        categoryId: b.categoryId,
                        accountIds: b.accountIds,
                        amount,
                    };
                });
                if (Object.keys(nextErrors).length) {
                    setRowErrors(nextErrors);
                    toast.error("Enter valid amounts and categories.");
                    return;
                }
                const payload = {
                    month,
                    currencyCode,
                    budgets: budgetPayload,
                };

                const form = new FormData();
                form.append("payload", JSON.stringify(payload));
                await saveBudgetsAction(form);

                const thresholdsPayload = new FormData();
                thresholdsPayload.append(
                    "payload",
                    JSON.stringify({
                        items: categories.map((cat) => ({
                            categoryId: cat.id,
                            levels: thresholdDrafts[cat.id] ?? [],
                        })),
                    }),
                );
                await saveBudgetThresholdsAction(thresholdsPayload);

                setRowErrors({});
                setBanner("Budgets and alerts saved.");
                toast.success("Budgets saved");
            } catch (error) {
                console.error(error);
                const message = error instanceof Error ? error.message : "Unable to save budgets";
                toast.error(message);
                setBanner(message);
            }
        });
    };

    return (
        <>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                {isPending || isSwitchingCurrency ? (
                    <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
                        {isSwitchingCurrency ? "Switching currency…" : "Saving budgets…"}
                    </div>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold text-slate-900">Monthly budgets</h2>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                Currency: {currencyCode}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">Cycle: {cycleLabel}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-700 shadow-inner">
                            <button
                                type="button"
                                onClick={() => setViewMode("table")}
                                className={`rounded-full px-3 py-1 transition ${viewMode === "table" ? "bg-white shadow-sm text-slate-900" : "text-slate-600"}`}
                            >
                                Table
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("cards")}
                                className={`rounded-full px-3 py-1 transition ${viewMode === "cards" ? "bg-white shadow-sm text-slate-900" : "text-slate-600"}`}
                            >
                                Cards
                            </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={handleAddBudget}
                                disabled={isBusy}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <span className="text-indigo-500">＋</span> Add budget
                            </button>
                            <button
                                type="button"
                                onClick={handleGenerateDefaults}
                                disabled={isBusy}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <span className="text-indigo-500">⟳</span> Generate defaults
                            </button>
                            <button
                                type="submit"
                                form="budgets-form"
                                disabled={isBusy}
                                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                💾 Save all
                            </button>
                        </div>
                    </div>
                </div>
                {banner ? <p className="mt-2 text-xs font-medium text-emerald-600">{banner}</p> : null}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                    <p className="text-xs text-slate-500">
                        Alerts fire per category when spend crosses these % thresholds.
                    </p>
                    <button
                        type="button"
                        onClick={() => setThresholdDrafts(buildThresholds(categories, initialThresholds))}
                        className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-500"
                    >
                        Reset alerts to defaults
                    </button>
                </div>

                <form id="budgets-form" onSubmit={handleSave} className="mt-5 space-y-3">
                    {budgets.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                            No budgets yet. Add one to get started.
                        </p>
                    ) : viewMode === "table" ? (
                        <div className="overflow-auto rounded-2xl border border-slate-100">
                            <table className="w-full min-w-[660px] text-sm">
                                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Category</th>
                                        <th className="px-3 py-2 text-left hidden sm:table-cell">Accounts</th>
                                        <th className="px-3 py-2 text-right">Amount</th>
                                        <th className="px-3 py-2 text-right">Spent</th>
                                        <th className="px-3 py-2 text-left">% Used</th>
                                        <th className="px-3 py-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {budgets.map((budget) => {
                                        const budgetCents = Math.round(Number(budget.amount || 0) * 100);
                                        const spentCents = Number(budget.spent || 0);
                                        const usedPct = budgetCents === 0 ? 0 : Math.min(100, (spentCents / budgetCents) * 100);
                                        const stat = stats[budget.categoryId];
                                        const categoryName = categoryMap.get(budget.categoryId) ?? "Uncategorized";
                                        const accountsLabel =
                                            budget.accountIds.length === 0
                                                ? "All accounts"
                                                : accountOptions
                                                    .filter((opt) => budget.accountIds.includes(opt.value))
                                                    .map((opt) => opt.label)
                                                    .join(", ");
                                        return (
                                            <tr key={budget.localId} className="border-t border-slate-100">
                                                <td className="px-3 py-2 min-w-[180px]">
                                                    <Select
                                                        options={categoryOptions}
                                                        value={categoryOptions.find((opt) => opt.value === budget.categoryId) ?? null}
                                                        isDisabled={isBusy}
                                                        instanceId={`category-${budget.localId}`}
                                                        onChange={(opt) => {
                                                            setBudgets((prev) =>
                                                                prev.map((b) =>
                                                                    b.localId === budget.localId ? { ...b, categoryId: opt?.value ?? "" } : b,
                                                                ),
                                                            );
                                                            setRowErrors((errs) => ({
                                                                ...errs,
                                                                [budget.localId]: { ...errs[budget.localId], category: undefined },
                                                            }));
                                                        }}
                                                        classNamePrefix="category-select"
                                                        className="text-sm"
                                                    />
                                                    {rowErrors[budget.localId]?.category ? (
                                                        <p className="text-[11px] text-rose-600">{rowErrors[budget.localId]?.category}</p>
                                                    ) : null}
                                                    {/* <div className="mt-1 flex flex-wrap items-center gap-1">
														<StatBadge
															label="Prev"
															value={`${currencyFormatter.format((stat?.prevSpentCents ?? 0) / 100)} / ${currencyFormatter.format((stat?.prevBudgetCents ?? 0) / 100)}`}
															tone={(stat?.prevUsedPct ?? 0) >= 100 ? "rose" : (stat?.prevUsedPct ?? 0) >= 80 ? "amber" : "indigo"}
														/>
													</div> */}
                                                </td>
                                                <td className="px-3 py-2 min-w-[180px] max-w-[220px] hidden sm:table-cell">
                                                    <Select
                                                        isMulti
                                                        isDisabled={isBusy}
                                                        options={accountOptions}
                                                        value={accountOptions.filter((opt) => budget.accountIds.includes(opt.value))}
                                                        instanceId={`accounts-${budget.localId}`}
                                                        onChange={(values) =>
                                                            setBudgets((prev) =>
                                                                prev.map((b) =>
                                                                    b.localId === budget.localId ? { ...b, accountIds: values.map((v) => v.value) } : b,
                                                                ),
                                                            )
                                                        }
                                                        placeholder="All accounts"
                                                        classNamePrefix="accounts-select"
                                                        className="text-sm"
                                                    />
                                                    <p className="text-[11px] text-slate-500 sm:mt-1">{accountsLabel}</p>
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <input
                                                        value={budget.amount}
                                                        disabled={isBusy}
                                                        onChange={(e) => {
                                                            setBudgets((prev) =>
                                                                prev.map((b) =>
                                                                    b.localId === budget.localId ? { ...b, amount: e.target.value } : b,
                                                                ),
                                                            );
                                                            setRowErrors((errs) => ({
                                                                ...errs,
                                                                [budget.localId]: { ...errs[budget.localId], amount: undefined },
                                                            }));
                                                        }}
                                                        inputMode="decimal"
                                                        className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                    />
                                                    {rowErrors[budget.localId]?.amount ? (
                                                        <p className="text-[11px] text-rose-600">{rowErrors[budget.localId]?.amount}</p>
                                                    ) : null}
                                                    <div className="mt-1">
                                                        <StatBadge
                                                            label="Prev"
                                                            value={`${currencyFormatter.format((stat?.prevSpentCents ?? 0) / 100)} / ${currencyFormatter.format((stat?.prevBudgetCents ?? 0) / 100)}`}
                                                            tone={(stat?.prevUsedPct ?? 0) >= 100 ? "rose" : (stat?.prevUsedPct ?? 0) >= 80 ? "amber" : "indigo"}
                                                        />
                                                        <div className="text-[11px] text-slate-500">Spent / Budget last month</div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono text-sm text-slate-700">
                                                    {currencyFormatter.format(spentCents / 100)}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs font-semibold text-slate-600">{usedPct.toFixed(1)}%</span>
                                                        <BudgetBar pct={usedPct} />
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSaveRow(budget)}
                                                        disabled={savingId === budget.localId || isBusy}
                                                        className="mr-3 text-xs font-semibold text-indigo-600 transition hover:text-indigo-500 disabled:opacity-50"
                                                    >
                                                        {savingId === budget.localId ? "Saving…" : "Save"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(budget)}
                                                        disabled={deletingId === budget.id || isBusy}
                                                        className="text-xs font-semibold text-rose-600 transition hover:text-rose-500 disabled:opacity-50"
                                                    >
                                                        {deletingId === budget.id ? "Removing…" : "Delete"}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {budgets.map((budget) => {
                                const budgetCents = Math.round(Number(budget.amount || 0) * 100);
                                const spentCents = Number(budget.spent || 0);
                                const usedPct = budgetCents === 0 ? 0 : Math.min(100, (spentCents / budgetCents) * 100);
                                const categoryName = categoryMap.get(budget.categoryId) ?? "Uncategorized";
                                const stat = stats[budget.categoryId];
                                const accountsLabel =
                                    budget.accountIds.length === 0
                                        ? "All accounts"
                                        : accountOptions
                                            .filter((opt) => budget.accountIds.includes(opt.value))
                                            .map((opt) => opt.label)
                                            .join(", ");
                                return (
                                    <details
                                        key={budget.localId}
                                        className="rounded-2xl border border-slate-100 bg-white shadow-sm"
                                        open={openCards.has(budget.localId)}
                                        onToggle={(e) => {
                                            const isOpen = (e.target as HTMLDetailsElement).open;
                                            setOpenCards((prev) => {
                                                const next = new Set(prev);
                                                if (isOpen) next.add(budget.localId);
                                                else next.delete(budget.localId);
                                                return next;
                                            });
                                        }}
                                    >
                                        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-slate-900">
                                            <span>{categoryName} · {accountsLabel}</span>
                                            <span className="text-xs text-slate-500">
                                                {currencyFormatter.format(spentCents / 100)} / {currencyFormatter.format(budgetCents / 100)}
                                            </span>
                                        </summary>
                                        <div className="px-4 pb-4 pt-1 space-y-3">
                                            <div className="flex flex-col gap-3 md:grid md:grid-cols-[1fr,1fr] md:gap-4">
                                                <div className="grid gap-1">
                                                    <label className="text-xs font-semibold text-slate-700">Category</label>
                                                    <Select
                                                        options={categoryOptions}
                                                        value={categoryOptions.find((opt) => opt.value === budget.categoryId) ?? null}
                                                        isDisabled={isBusy}
                                                        instanceId={`card-category-${budget.localId}`}
                                                        onChange={(opt) => {
                                                            setBudgets((prev) =>
                                                                prev.map((b) =>
                                                                    b.localId === budget.localId ? { ...b, categoryId: opt?.value ?? "" } : b,
                                                                ),
                                                            );
                                                            setRowErrors((errs) => ({
                                                                ...errs,
                                                                [budget.localId]: { ...errs[budget.localId], category: undefined },
                                                            }));
                                                        }}
                                                        classNamePrefix="category-select"
                                                        className="text-sm"
                                                    />
                                                    {rowErrors[budget.localId]?.category ? (
                                                        <p className="text-[11px] text-rose-600">{rowErrors[budget.localId]?.category}</p>
                                                    ) : null}
                                                </div>
                                                <div className="grid gap-1">
                                                    <label className="text-xs font-semibold text-slate-700">Accounts</label>
                                                    <Select
                                                        isMulti
                                                        isDisabled={isBusy}
                                                        options={accountOptions}
                                                        value={accountOptions.filter((opt) => budget.accountIds.includes(opt.value))}
                                                        instanceId={`card-accounts-${budget.localId}`}
                                                        onChange={(values) =>
                                                            setBudgets((prev) =>
                                                                prev.map((b) =>
                                                                    b.localId === budget.localId ? { ...b, accountIds: values.map((v) => v.value) } : b,
                                                                ),
                                                            )
                                                        }
                                                        placeholder="All accounts (default)"
                                                        classNamePrefix="accounts-select"
                                                        className="text-sm"
                                                    />
                                                    <p className="text-[11px] text-slate-500">
                                                        {budget.accountIds.length ? accountsLabel : "Covers all accounts in this currency."}
                                                    </p>
                                                </div>
                                                <div className="grid gap-1">
                                                    <label className="text-xs font-semibold text-slate-700">Amount</label>
                                                    <input
                                                        value={budget.amount}
                                                        disabled={isBusy}
                                                        onChange={(e) => {
                                                            setBudgets((prev) =>
                                                                prev.map((b) =>
                                                                    b.localId === budget.localId ? { ...b, amount: e.target.value } : b,
                                                                ),
                                                            );
                                                            setRowErrors((errs) => ({
                                                                ...errs,
                                                                [budget.localId]: { ...errs[budget.localId], amount: undefined },
                                                            }));
                                                        }}
                                                        inputMode="decimal"
                                                        className="h-10 rounded-lg border border-slate-200 px-3 text-right text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                    />
                                                    {rowErrors[budget.localId]?.amount ? (
                                                        <p className="text-[11px] text-rose-600">{rowErrors[budget.localId]?.amount}</p>
                                                    ) : null}
                                                    <div className="mt-1">
                                                        <StatBadge
                                                            label="Prev"
                                                            value={`${currencyFormatter.format((stat?.prevSpentCents ?? 0) / 100)} / ${currencyFormatter.format((stat?.prevBudgetCents ?? 0) / 100)}`}
                                                            tone={(stat?.prevUsedPct ?? 0) >= 100 ? "rose" : (stat?.prevUsedPct ?? 0) >= 80 ? "amber" : "indigo"}
                                                        />
                                                        <div className="text-[11px] text-slate-500">Spent / Budget last month</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-[1fr,1fr]">
                                                <div>
                                                    <div className="text-xs font-semibold text-slate-600">Spent vs budget</div>
                                                    <div className="text-sm text-slate-700">
                                                        {currencyFormatter.format(spentCents / 100)} / {currencyFormatter.format(budgetCents / 100)}
                                                    </div>
                                                    <div className="mt-1 w-full">
                                                        <BudgetBar pct={usedPct} />
                                                        <p className="text-[11px] text-slate-500">{usedPct.toFixed(1)}% used</p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold text-slate-600">Alerts</label>
                                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                                        {(thresholdDrafts[budget.categoryId] ?? []).map((level) => (
                                                            <span key={level} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">
                                                                {level}%
                                                                <button
                                                                    type="button"
                                                                    disabled={isBusy}
                                                                    onClick={() => removeThreshold(budget.categoryId, level)}
                                                                    className="text-indigo-500 hover:text-indigo-700 disabled:opacity-50"
                                                                >
                                                                    ×
                                                                </button>
                                                            </span>
                                                        ))}
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={100}
                                                            placeholder="Add %"
                                                            disabled={isBusy}
                                                            value={thresholdInputs[budget.categoryId] ?? ""}
                                                            onChange={(e) =>
                                                                setThresholdInputs((prev) => ({
                                                                    ...prev,
                                                                    [budget.categoryId]: e.target.value,
                                                                }))
                                                            }
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter" || e.key === "," || e.key === " ") {
                                                                    e.preventDefault();
                                                                    const parsed = Number((e.target as HTMLInputElement).value);
                                                                    if (!Number.isNaN(parsed)) {
                                                                        addThreshold(budget.categoryId, parsed);
                                                                    }
                                                                }
                                                            }}
                                                            onBlur={(e) => {
                                                                const parsed = Number(e.target.value);
                                                                if (!Number.isNaN(parsed)) {
                                                                    addThreshold(budget.categoryId, parsed);
                                                                }
                                                            }}
                                                            className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                                        />
                                                        {(thresholdDrafts[budget.categoryId] ?? []).length === 0 ? (
                                                            <span className="text-[11px] text-slate-500">No alerts</span>
                                                        ) : null}
                                                    </div>
                                                    <p className="text-[11px] text-slate-500">Alerts run on spend % for this category.</p>
                                                </div>
                                            </div>
                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveRow(budget)}
                                                    disabled={savingId === budget.localId || isBusy}
                                                    className="mr-4 text-xs font-semibold text-indigo-600 transition hover:text-indigo-500 disabled:opacity-50"
                                                >
                                                    {savingId === budget.localId ? "Saving…" : "Save budget"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(budget)}
                                                    disabled={deletingId === budget.id || isBusy}
                                                    className="text-xs font-semibold text-rose-600 transition hover:text-rose-500 disabled:opacity-50"
                                                >
                                                    {deletingId === budget.id ? "Removing…" : "Delete budget"}
                                                </button>
                                            </div>
                                        </div>
                                    </details>
                                );
                            })}
                        </div>
                    )}
                </form>
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
                            <BudgetBar pct={totalBudgetCents === 0 ? 0 : Math.min(100, (totalSpentCents / totalBudgetCents) * 100)} />
                            <p className="mt-1 text-right text-xs text-white/70">
                                {totalBudgetCents === 0 ? "No planned budget" : `${((totalSpentCents / totalBudgetCents) * 100).toFixed(1)}% used`}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
