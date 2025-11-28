import { redirect } from "next/navigation";

import { MobileNav } from "@/app/_components/mobile-nav";
import BudgetTable from "@/app/budgets/table";
import { getBudgetSummary, getCategorySpendMap } from "@/lib/budgets";
import { MonthSelector } from "@/app/budgets/_components/month-selector";
import { CopyBudgetsButton } from "@/app/budgets/_components/copy-budgets-button";
import { DeleteMonthBudgetsButton } from "@/app/budgets/_components/delete-month-budgets-button";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { currentCycleKeyForDate, getCycleRange } from "@/lib/pay-cycle";
import { OfflineFallback } from "@/app/_components/offline-fallback";

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

export default async function BudgetsPage({ searchParams }: { searchParams?: SearchParams | Promise<SearchParams> }) {
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

    const maybePromise = searchParams as Promise<SearchParams> | SearchParams | undefined;
    const resolvedSearchParams =
        maybePromise && typeof (maybePromise as Promise<unknown>).then === "function"
            ? await (maybePromise as Promise<SearchParams>)
            : (maybePromise as SearchParams) ?? {};

    const { data: settingsData } = await supabase
        .from("user_settings")
        .select("currency_code, pay_cycle_start_day")
        .eq("user_id", user.id)
        .maybeSingle();

    const payCycleStartDay = settingsData?.pay_cycle_start_day ?? 1;
    const currencyCode = settingsData?.currency_code ?? "USD";
    const monthParam = resolvedSearchParams?.month;
    const requestedMonth = Array.isArray(monthParam) ? monthParam[0] : monthParam;
    const defaultCycleKey = currentCycleKeyForDate(new Date(), payCycleStartDay);
    const month = requestedMonth && MONTH_REGEX.test(requestedMonth) ? requestedMonth : defaultCycleKey;

    const [{ data: categoryRows }, summary, categorySpend, { data: budgetMonthRows }] = await Promise.all([
        supabase
            .from("categories")
            .select("id, name")
            .eq("user_id", user.id)
            .eq("type", "expense")
            .is("deleted_at", null)
            .order("name", { ascending: true }),
        getBudgetSummary(month),
        getCategorySpendMap(month, payCycleStartDay),
        supabase.from("budgets").select("month, amount_cents").eq("user_id", user.id).is("deleted_at", null),
    ]);

    const categories = categoryRows ?? [];
    const monthTotalsMap = new Map<string, number>();
    for (const row of budgetMonthRows ?? []) {
        monthTotalsMap.set(row.month, (monthTotalsMap.get(row.month) ?? 0) + row.amount_cents);
    }
    const copyFromOptions = Array.from(monthTotalsMap.entries())
        .filter(([key]) => key !== month)
        .sort(([a], [b]) => (a > b ? -1 : 1))
        .map(([key, total]) => ({ month: key, totalCents: total }));
    const cycleRange = getCycleRange(month, payCycleStartDay);
    const rangeFormatter = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
    const cycleLabel = `${rangeFormatter.format(cycleRange.startDate)} – ${rangeFormatter.format(cycleRange.endDateInclusive)}`;

    perfLog("page total", pageStart);

    return (
        <div className="min-h-screen bg-slate-50">
            <MobileNav />
            <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-6">
                <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Plan ahead</p>
                        <h1 className="text-2xl font-semibold text-slate-900">Budgets</h1>
                        <p className="text-sm text-slate-500">Current cycle: {cycleLabel}</p>
                    </div>

                    <div className="flex flex-col gap-4">
                        <MonthSelector month={month} />
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <CopyBudgetsButton month={month} months={copyFromOptions} currencyCode={currencyCode} />
                            <DeleteMonthBudgetsButton month={month} />
                        </div>
                    </div>
                </section>

                <section>
                    <BudgetTable
                        month={month}
                        categories={categories}
                        summary={summary}
                        categorySpend={categorySpend ?? {}}
                        currencyCode={currencyCode}
                        cycleLabel={cycleLabel}
                    />
                </section>
            </main>
        </div>
    );
}
