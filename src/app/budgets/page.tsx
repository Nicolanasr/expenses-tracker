/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";

import { MobileNav } from "@/app/_components/mobile-nav";
import BudgetTable from "@/app/budgets/table";
import { getBudgetSummary } from "@/lib/budgets";
import { MonthSelector } from "@/app/budgets/_components/month-selector";
import { CopyBudgetsButton } from "@/app/budgets/_components/copy-budgets-button";
import { DeleteMonthBudgetsButton } from "@/app/budgets/_components/delete-month-budgets-button";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { currentCycleKeyForDate, getCycleRange, shiftMonth } from "@/lib/pay-cycle";
import { OfflineFallback } from "@/app/_components/offline-fallback";
import { CurrencySwitcher } from "@/app/budgets/_components/currency-switcher";
import { toCents } from "@/lib/money";

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export const dynamic = "force-dynamic";
const PERF_ENABLED = true;

function getTimeMs() {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
        return performance.now();
    }
    return Date.now();
}

function perfLog(label: string, start: number | undefined) {
    if (!PERF_ENABLED || typeof start !== "number") return;
    const duration = getTimeMs() - start;
    console.log(`[perf][budgets] ${label}: ${duration}ms`);
}

type SearchParams = Record<string, string | string[] | undefined>;

type CategoryStats = {
    prevBudgetCents: number;
    prevSpentCents: number;
    prevUsedPct: number;
    minSpendCents: number;
};

export default async function BudgetsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
    const pageStart = PERF_ENABLED ? getTimeMs() : undefined;
    const supabase = await createSupabaseServerComponentClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError?.name == "AuthRetryableFetchError") {
        return <OfflineFallback />;
    }

    if (!user) {
        redirect("/auth/sign-in");
    }

    if (userError || !user) {
        return <OfflineFallback />;
    }

    const resolvedSearchParams = searchParams ? await searchParams : {};

    const { data: settingsData } = await supabase
        .from("user_settings")
        .select("currency_code, pay_cycle_start_day, budget_thresholds")
        .eq("user_id", user.id)
        .maybeSingle();

    const payCycleStartDay = settingsData?.pay_cycle_start_day ?? 1;
    const defaultCurrency = settingsData?.currency_code ?? "USD";
    const monthParam = resolvedSearchParams?.month;
    const requestedMonth = Array.isArray(monthParam) ? monthParam[0] : monthParam;
    const defaultCycleKey = currentCycleKeyForDate(new Date(), payCycleStartDay);
    const month = requestedMonth && MONTH_REGEX.test(requestedMonth) ? requestedMonth : defaultCycleKey;

    const [{ data: categoryRows }, { data: budgetMonthRows }, { data: accountRows }] = await Promise.all([
        supabase
            .from("categories")
            .select("id, name")
            .eq("user_id", user.id)
            .eq("type", "expense")
            .is("deleted_at", null)
            .order("name", { ascending: true }),
        supabase.from("budgets").select("month, amount_cents, currency_code").eq("user_id", user.id).is("deleted_at", null),
        supabase.from("accounts").select("id, name, currency_code").eq("user_id", user.id).is("deleted_at", null),
    ]);
    const thresholdsMap = Object.fromEntries(
        Array.isArray(settingsData?.budget_thresholds)
            ? (settingsData?.budget_thresholds as { categoryId?: string; levels?: number[] }[])
                .filter((item) => typeof item.categoryId === "string" && item.categoryId)
                .map((item) => [
                    item.categoryId as string,
                    Array.isArray(item.levels)
                        ? item.levels.filter((n) => typeof n === "number").map((n) => Number(n))
                        : [],
                ])
            : [],
    );

    const categories = categoryRows ?? [];
    const availableCurrencies = Array.from(
        new Set(
            (accountRows ?? [])
                .map((a) => a.currency_code)
                .filter((c): c is string => Boolean(c))
                .map((c) => c.toUpperCase()),
        ),
    );
    const currencyParam = Array.isArray(resolvedSearchParams.currency) ? resolvedSearchParams.currency[0] : resolvedSearchParams.currency;
    const currencyCodeRaw = (currencyParam ?? defaultCurrency).toUpperCase();
    const currencyCode = availableCurrencies.includes(currencyCodeRaw) ? currencyCodeRaw : availableCurrencies[0] ?? currencyCodeRaw;
    const accountsForCurrency = (accountRows ?? []).filter((a) => (a.currency_code ?? "").toUpperCase() === currencyCode);
    const [rawSummary, prevSummary] = await Promise.all([
        getBudgetSummary(month, currencyCode),
        getBudgetSummary(shiftMonth(month, -1), currencyCode),
    ]);
    // Dedupe budgets by id in case of any join duplicates
    const summary = Array.from(new Map(rawSummary.map((row) => [row.id, row])).values());
    // Ensure account_ids are accurate by merging the join table for the returned budgets
    const budgetIds = summary.map((row) => row.id).filter(Boolean);
    if (budgetIds.length) {
        const { data: budgetAccounts } = await supabase
            .from("budget_accounts")
            .select("budget_id, account_id")
            .in("budget_id", budgetIds);
        const accountsByBudget = new Map<string, string[]>();
        (budgetAccounts ?? []).forEach((row) => {
            if (!row.budget_id || !row.account_id) return;
            const list = accountsByBudget.get(row.budget_id) ?? [];
            if (!list.includes(row.account_id)) {
                list.push(row.account_id);
                accountsByBudget.set(row.budget_id, list);
            }
        });
        summary.forEach((row) => {
            const links = accountsByBudget.get(row.id);
            if (links && links.length) {
                (row as any).account_ids = links;
            } else if (!Array.isArray((row as any).account_ids)) {
                (row as any).account_ids = [];
            }
        });
    }
    const filteredSummary = summary.filter((row) => (row.currency_code ?? currencyCode) === currencyCode);
    const prevSummaryMap = new Map<string, { budget_cents: number; spent_cents: number }>();
    prevSummary.forEach((row) => {
        prevSummaryMap.set(row.category_id, { budget_cents: row.budget_cents, spent_cents: row.spent_cents });
    });
    const monthTotalsMap = new Map<string, number>(); // key: `${month}-${CURRENCY}`
    for (const row of budgetMonthRows ?? []) {
        const key = `${row.month}-${(row.currency_code ?? "USD").toUpperCase()}`;
        monthTotalsMap.set(key, (monthTotalsMap.get(key) ?? 0) + row.amount_cents);
    }
    const mapKey = `${month}-${currencyCode}`;
    const totalPlannedCents = monthTotalsMap.get(mapKey) ?? 0;
    const hasBudgetsThisMonth = (monthTotalsMap.get(mapKey) ?? 0) > 0;
    const copyFromOptions = hasBudgetsThisMonth
        ? []
        : Array.from(monthTotalsMap.entries())
            .filter(([key]) => key.endsWith(`-${currencyCode}`) && key !== mapKey)
            .map(([key, total]) => ({ month: key.replace(`-${currencyCode}`, ""), totalCents: total }))
            .sort((a, b) => (a.month > b.month ? -1 : 1));
    const cycleRange = getCycleRange(month, payCycleStartDay);
    const rangeFormatter = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
    const cycleLabel = `${rangeFormatter.format(cycleRange.startDate)} – ${rangeFormatter.format(cycleRange.endDateInclusive)}`;

    // Spend stats for last 3 months (excluding current)
    const prevMonths = [shiftMonth(month, -1), shiftMonth(month, -2), shiftMonth(month, -3)];
    const monthsSet = new Set(prevMonths);
    const windowStart = getCycleRange(prevMonths[2], payCycleStartDay).startISO;
    const windowEnd = getCycleRange(month, payCycleStartDay).startISO;
    const { data: txRows } = await supabase
        .from("transactions")
        .select("category_id, amount, currency_code, occurred_on")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .eq("currency_code", currencyCode)
        .is("deleted_at", null)
        .gte("occurred_on", windowStart)
        .lt("occurred_on", windowEnd);
    const spendBuckets = new Map<string, Map<string, number>>(); // month -> category -> cents
    (txRows ?? []).forEach((row) => {
        const key = currentCycleKeyForDate(new Date(row.occurred_on), payCycleStartDay);
        if (!monthsSet.has(key)) return;
        const catId = row.category_id;
        if (!catId) return;
        const cents = toCents(Number(row.amount ?? 0));
        const monthMap = spendBuckets.get(key) ?? new Map<string, number>();
        monthMap.set(catId, (monthMap.get(catId) ?? 0) + cents);
        spendBuckets.set(key, monthMap);
    });

    const stats: Record<string, CategoryStats> = {};
    categories.forEach((cat) => {
        const prevSpent = spendBuckets.get(prevMonths[0])?.get(cat.id) ?? 0;
        const prevBudget = prevSummaryMap.get(cat.id)?.budget_cents ?? 0;
        const prevUsedPct = prevBudget === 0 ? 0 : Math.min(999, (prevSpent / prevBudget) * 100);
        const windowSpends = prevMonths
            .map((m) => spendBuckets.get(m)?.get(cat.id) ?? 0)
            .filter((v) => Number.isFinite(v));
        const values = windowSpends.length ? windowSpends : [0];
        const min = values.length ? Math.min(...values) : 0;
        stats[cat.id] = {
            prevBudgetCents: prevBudget,
            prevSpentCents: prevSpent,
            prevUsedPct,
            minSpendCents: min,
        };
    });

    perfLog("page total", pageStart);

    return (
        <div className="min-h-screen bg-slate-50">
            <MobileNav />
            <main className=" mx-auto flex w-full max-w-6xl flex-col gap-6 py-6">
                <section className="space-y-4 rounded-3xl border border-slate-200 bg-white ">
                    <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-5 ">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Plan ahead</p>
                                <h1 className="text-2xl font-semibold text-slate-900">Budgets</h1>
                                <p className="text-sm text-slate-500">Track and adjust this cycle’s plan.</p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-100">
                                        Cycle: {cycleLabel}
                                    </span>
                                    <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
                                        Currency: {currencyCode}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
                                <label className="text-xs font-semibold text-slate-700">Currency</label>
                                <CurrencySwitcher month={month} current={currencyCode} options={availableCurrencies} />
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planned this month</p>
                                <p className="text-xl font-semibold text-slate-900">
                                    {new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(totalPlannedCents / 100)}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Categories with budgets</p>
                                <p className="text-xl font-semibold text-slate-900">{filteredSummary.length}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Month</p>
                                <p className="text-xl font-semibold text-slate-900">{month}</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                            <div className="">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-700">Cycle month</span>
                                    <MonthSelector month={month} />
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    {copyFromOptions.length ? (
                                        <CopyBudgetsButton month={month} months={copyFromOptions} currencyCode={currencyCode} />
                                    ) : null}
                                    <DeleteMonthBudgetsButton month={month} currencyCode={currencyCode} />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section>
                    <BudgetTable
                        month={month}
                        categories={categories}
                        summary={filteredSummary}
                        currencyCode={currencyCode}
                        cycleLabel={cycleLabel}
                        initialThresholds={thresholdsMap}
                        accounts={accountsForCurrency.map((a) => ({ id: a.id, name: a.name ?? "Account", currency_code: a.currency_code?.toUpperCase() ?? currencyCode }))}
                        stats={stats}
                    />
                </section>

            </main>
        </div>
    );
}
