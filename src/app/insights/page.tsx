import { Suspense } from 'react';

import { MobileNav } from '@/app/_components/mobile-nav';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { currentCycleKeyForDate, getCycleRange } from '@/lib/pay-cycle';
import { OfflineFallback } from '@/app/_components/offline-fallback';
import InsightsFilters from './_components/insights-filters';

type AggRow = { type: 'income' | 'expense'; amount: number };
type CategoryAgg = { category_id: string | null; categories: { name: string | null | undefined }; amount: number };
type DailyAgg = { occurred_on: string; type: 'income' | 'expense'; amount: number };

const PERF_ENABLED = true;
function getTimeMs() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
    return Date.now();
}
function perfLog(label: string, start: number | undefined) {
    if (!PERF_ENABLED || typeof start !== 'number') return;
    console.log(`[perf][insights] ${label}: ${getTimeMs() - start}ms`);
}

function fmtCurrency(value: number, currencyCode: string) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(value);
}
function pctDelta(current: number, prev: number) {
    if (!prev) return current === 0 ? 0 : 100;
    return ((current - prev) / prev) * 100;
}

function sanitizeAgg(rows: unknown): AggRow[] {
    if (!Array.isArray(rows)) return [];
    return rows
        .map((row) => {
            if (!row || typeof row !== 'object') return null;
            const rec = row as Record<string, unknown>;
            const t = rec.type;
            if (t !== 'income' && t !== 'expense') return null;
            return { type: t, amount: Number(rec.amount ?? 0) };
        })
        .filter((r): r is AggRow => Boolean(r));
}

function sanitizeDaily(rows: unknown): DailyAgg[] {
	if (!Array.isArray(rows)) return [];
	return rows
		.map((row) => {
			if (!row || typeof row !== 'object') return null;
            const rec = row as Record<string, unknown>;
            const t = rec.type;
            if (t !== 'income' && t !== 'expense') return null;
            const occurred_on = typeof rec.occurred_on === 'string' ? rec.occurred_on : null;
            if (!occurred_on) return null;
            return { occurred_on, type: t, amount: Number(rec.amount ?? 0) };
		})
		.filter((r): r is DailyAgg => Boolean(r));
}

function sanitizeCategories(rows: unknown): CategoryAgg[] {
	if (!Array.isArray(rows)) return [];
	return rows
		.map((row) => {
			if (!row || typeof row !== 'object') return null;
			const rec = row as Record<string, unknown>;
			const category_id = typeof rec.category_id === 'string' ? rec.category_id : null;
			const amount = Number(rec.amount ?? 0);
			const name =
				rec.categories &&
				typeof rec.categories === 'object' &&
				'name' in rec.categories &&
				typeof (rec.categories as { name?: unknown }).name === 'string'
					? (rec.categories as { name?: string }).name
					: null;
			return { category_id, amount, categories: { name } };
		})
		.filter((r): r is CategoryAgg => Boolean(r));
}

export const dynamic = 'force-dynamic';

export default async function InsightsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const supabase = await createSupabaseServerComponentClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError?.name === 'AuthRetryableFetchError') return <OfflineFallback />;
    if (!user) return <OfflineFallback />;

    const resolved = searchParams ? await searchParams : {};
    const today = new Date();
    const defaultCycleKey = currentCycleKeyForDate(today, 1);
    const defaultRange = getCycleRange(defaultCycleKey, 1);

    const startParam = resolved.start && !Array.isArray(resolved.start) ? resolved.start : undefined;
    const endParam = resolved.end && !Array.isArray(resolved.end) ? resolved.end : undefined;
    const start = startParam ?? defaultRange.startISO;
    const end = endParam ?? defaultRange.endISOInclusive;

    const prevDate = new Date(start);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevKey = currentCycleKeyForDate(prevDate, 1);
    const prevRange = getCycleRange(prevKey, 1);

    const settingsStart = getTimeMs();
    const { data: settings } = await supabase
        .from('user_settings')
        .select('currency_code')
        .eq('user_id', user.id)
        .maybeSingle();
    perfLog('settings', settingsStart);
    const currencyCode = settings?.currency_code ?? 'USD';

    const dataStart = getTimeMs();
    const categoryFilter = resolved.category && !Array.isArray(resolved.category) ? resolved.category : undefined;

    const buildTxQuery = (rangeStart: string, rangeEnd: string, select: string) => {
        let q = supabase
            .from('transactions')
            .select(select)
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .not('payment_method', 'in', '("account_transfer","bank_transfer")')
            .gte('occurred_on', rangeStart)
            .lte('occurred_on', rangeEnd);
        if (categoryFilter) {
            q = q.eq('category_id', categoryFilter);
        }
        return q;
    };

    const [currentRes, prevRes, currentDaily, currentCategories, categoryList] = await Promise.all([
        buildTxQuery(start, end, 'type, amount'),
        buildTxQuery(prevRange.startISO, prevRange.endISOInclusive, 'type, amount'),
        buildTxQuery(start, end, 'occurred_on, type, amount'),
        buildTxQuery(start, end, 'category_id, amount, categories(name)'),
        supabase
            .from('categories')
            .select('id, name')
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .order('name', { ascending: true }),
    ]);
    perfLog('fetch', dataStart);

    const sumByType = (rows: AggRow[]) =>
        rows.reduce(
            (acc, row) => {
                if (row.type === 'income') acc.income += Number(row.amount ?? 0);
                else acc.expense += Number(row.amount ?? 0);
                return acc;
            },
            { income: 0, expense: 0 },
        );
    const currentSums = sumByType(sanitizeAgg(currentRes.data));
    const prevSums = sumByType(sanitizeAgg(prevRes.data));

    const dailyMap = new Map<string, { income: number; expense: number }>();
    sanitizeDaily(currentDaily.data).forEach((row) => {
        const entry = dailyMap.get(row.occurred_on) ?? { income: 0, expense: 0 };
        if (row.type === 'income') entry.income += Number(row.amount ?? 0);
        else entry.expense += Number(row.amount ?? 0);
        dailyMap.set(row.occurred_on, entry);
    });
    const daily = Array.from(dailyMap.entries())
        .sort(([a], [b]) => (a > b ? 1 : -1))
        .map(([date, val]) => ({ date, ...val }));
    const rangeDays = Math.max(
        1,
        Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)),
    );
    const daysElapsed = daily.length || 1;
    const avgDailySpend = currentSums.expense / daysElapsed;
    const avgDailyIncome = currentSums.income / daysElapsed;
    const projectedExpense = avgDailySpend * rangeDays;
    const projectedIncome = avgDailyIncome * rangeDays;
    const projectedNet = projectedIncome - projectedExpense;

	const catData = sanitizeCategories(currentCategories.data);
	const categoryTotals = new Map<string, number>();
	catData.forEach((row) => {
		const key = row.category_id ?? 'uncategorised';
		categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + Number(row.amount ?? 0));
	});
	const topCategories = Array.from(categoryTotals.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3)
		.map(([id, amount]) => {
			const match = catData.find((row) => row.category_id === id);
			return { id, name: id === 'uncategorised' ? 'Uncategorised' : match?.categories?.name ?? 'Category', amount };
		});

    return (
        <div className="min-h-screen bg-slate-50">
            <MobileNav />
            <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-6">
                <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Insights</p>
                            <h1 className="text-2xl font-semibold text-slate-900">Finance & Budgeting Snapshot</h1>
                            <p className="text-sm text-slate-500">Current vs previous period. Transfers excluded.</p>
                        </div>
                        <div className="text-xs text-slate-500">
                            <p title="Current">{start} → {end}</p>
                            <p title="Previous">{prevRange.startISO} → {prevRange.endISOInclusive}</p>
                        </div>
                    </div>
                    <InsightsFilters
                        categories={categoryList.data ?? []}
                        initialStart={start}
                        initialEnd={end}
                        initialCategory={categoryFilter}
                    />
                </header>

                <Suspense fallback={<div className="h-64 rounded-3xl border border-slate-200 bg-white" />}>
                    <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <InsightCard
                                title="Income (MoM)"
                                tooltip="Total income this period vs previous period. Transfers excluded."
                                value={fmtCurrency(currentSums.income, currencyCode)}
                                delta={pctDelta(currentSums.income, prevSums.income)}
                                positive
                            />
                            <InsightCard
                                title="Expenses (MoM)"
                                tooltip="Total expenses this period vs previous period. Transfers excluded."
                                value={fmtCurrency(currentSums.expense, currencyCode)}
                                delta={pctDelta(currentSums.expense, prevSums.expense)}
                                positive={false}
                            />
                            <InsightCard
                                title="Avg daily spend"
                                tooltip="Average daily expenses over the selected period."
                                value={fmtCurrency(avgDailySpend, currencyCode)}
                                sub={`Income pace: ${fmtCurrency(avgDailyIncome, currencyCode)}`}
                            />
                            <InsightCard
                                title="Projected net"
                                tooltip="Projection using current daily income/expense pace across the selected period length."
                                value={fmtCurrency(projectedNet, currencyCode)}
                                positive={projectedNet >= 0}
                                sub={`Income ${fmtCurrency(projectedIncome, currencyCode)} · Expense ${fmtCurrency(projectedExpense, currencyCode)}`}
                            />
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-3">
                            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top spend categories</p>
                                <div className="mt-2 space-y-1 text-[11px] font-semibold text-slate-700">
                                    {topCategories.length === 0 ? <p className="text-slate-500">No data yet.</p> : null}
                                    {topCategories.map((row) => (
                                        <div key={row.id} className="flex items-center justify-between">
                                            <span>{row.name}</span>
                                            <span>{fmtCurrency(row.amount, currencyCode)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                </Suspense>
            </main>
        </div>
    );
}

function InsightCard({
    title,
    tooltip,
    value,
    delta,
    sub,
    positive = true,
}: {
    title: string;
    tooltip?: string;
    value: string;
    delta?: number;
    sub?: string;
    positive?: boolean;
}) {
    const deltaColor = delta === undefined ? 'text-slate-600' : delta >= 0 ? 'text-emerald-600' : 'text-rose-600';
    return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3" title={tooltip}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
            <p className={`text-lg font-bold ${positive ? 'text-slate-900' : 'text-rose-700'}`}>{value}</p>
            {delta !== undefined ? <p className={`text-[11px] font-semibold ${deltaColor}`}>{delta.toFixed(1)}%</p> : null}
            {sub ? <p className="text-[11px] text-slate-600">{sub}</p> : null}
        </div>
    );
}

// Tips removed per request.
