import { redirect } from 'next/navigation';

import { DashboardFilters } from '@/app/_components/dashboard-filters';
import { DashboardSummaryCards } from '@/app/_components/dashboard-summary-cards';
import { MobileNav } from '@/app/_components/mobile-nav';
import { SummaryChart } from '@/app/_components/summary-chart';
import { TransactionItem } from '@/app/_components/transaction-item';
import { CategoryPieChart } from '@/app/_components/category-pie-chart';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { currentCycleKeyForDate, getCycleRange } from '@/lib/pay-cycle';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
    searchParams?: Promise<SearchParams>;
};

type CategoryRow = {
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: string | null;
    color: string | null;
};

type TransactionRow = {
    id: string;
    amount: number;
    type: 'income' | 'expense';
    currency_code: string;
    occurred_on: string;
    payment_method: 'cash' | 'card' | 'transfer' | 'other';
    notes: string | null;
    category_id: string | null;
    categories: CategoryRow | null;
};

type NormalizedTransaction = {
    id: string;
    amount: number;
    type: 'income' | 'expense';
    currencyCode: string;
    occurredOn: string;
    paymentMethod: 'cash' | 'card' | 'transfer' | 'other';
    notes: string | null;
    categoryId: string | null;
    category: {
        id: string;
        name: string;
        icon: string | null;
        color: string | null;
        type: 'income' | 'expense';
    } | null;
};

const PAYMENT_METHODS = ['card', 'cash', 'transfer', 'other'] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const MS_IN_DAY = 1000 * 60 * 60 * 24;

function inclusiveDayDiff(start: Date, end: Date) {
    const diff = Math.floor((end.getTime() - start.getTime()) / MS_IN_DAY);
    return diff >= 0 ? diff + 1 : 0;
}

function isPaymentMethod(value: string): value is PaymentMethod {
    return (PAYMENT_METHODS as readonly string[]).includes(value);
}

function parseParam(
    params: SearchParams,
    key: string,
): string | undefined {
    const raw = params?.[key];
    if (!raw) return undefined;
    if (Array.isArray(raw)) {
        return raw[0];
    }
    return raw;
}

function getMonthKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

function formatMonthLabel(date: Date) {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        year: 'numeric',
    }).format(date);
}

function getWeekStart(date: Date) {
    const copy = new Date(date.getTime());
    const day = copy.getDay();
    const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
    copy.setDate(diff);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function toISODate(date: Date) {
    return date.toISOString().slice(0, 10);
}

function formatWeekLabel(start: Date) {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
    }).format(start);
}

function normalizeTransactions(
    rows: TransactionRow[],
    fallbackCurrency: string,
): NormalizedTransaction[] {
    return rows.map((transaction) => ({
        id: transaction.id,
        amount: Number(transaction.amount ?? 0),
        type: transaction.type,
        currencyCode: transaction.currency_code ?? fallbackCurrency,
        occurredOn: transaction.occurred_on,
        paymentMethod: transaction.payment_method,
        notes: transaction.notes,
        categoryId: transaction.category_id ?? transaction.categories?.id ?? null,
        category: transaction.categories
            ? {
                id: transaction.categories.id,
                name: transaction.categories.name,
                icon: transaction.categories.icon,
                color: transaction.categories.color,
                type: transaction.categories.type,
            }
            : null,
    }));
}

function computeTimeline(
    transactions: NormalizedTransaction[],
    interval: 'month' | 'week' | 'day',
) {
    const buckets = new Map<
        string,
        { label: string; income: number; expenses: number; order: number }
    >();

    transactions.forEach((transaction) => {
        const occurred = new Date(transaction.occurredOn);
        if (Number.isNaN(occurred.getTime())) {
            return;
        }
        if (interval === 'month') {
            const key = getMonthKey(occurred);
            if (!buckets.has(key)) {
                const monthDate = new Date(occurred.getFullYear(), occurred.getMonth(), 1);
                buckets.set(key, {
                    label: formatMonthLabel(monthDate),
                    income: 0,
                    expenses: 0,
                    order: monthDate.getTime(),
                });
            }
            const bucket = buckets.get(key)!;
            if (transaction.type === 'income') {
                bucket.income += transaction.amount;
            } else {
                bucket.expenses += transaction.amount;
            }
        } else if (interval === 'week') {
            const weekStart = getWeekStart(occurred);
            const key = `${weekStart.getFullYear()}-W${String(
                weekStart.getMonth() + 1,
            ).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
            if (!buckets.has(key)) {
                buckets.set(key, {
                    label: `Week of ${formatWeekLabel(weekStart)}`,
                    income: 0,
                    expenses: 0,
                    order: weekStart.getTime(),
                });
            }
            const bucket = buckets.get(key)!;
            if (transaction.type === 'income') {
                bucket.income += transaction.amount;
            } else {
                bucket.expenses += transaction.amount;
            }
        } else {
            const key = occurred.toISOString().slice(0, 10);
            if (!buckets.has(key)) {
                buckets.set(key, {
                    label: formatWeekLabel(occurred),
                    income: 0,
                    expenses: 0,
                    order: new Date(key).getTime(),
                });
            }
            const bucket = buckets.get(key)!;
            if (transaction.type === 'income') {
                bucket.income += transaction.amount;
            } else {
                bucket.expenses += transaction.amount;
            }
        }
    });

    return Array.from(buckets.values())
        .sort((a, b) => a.order - b.order)
        .map((bucket) => ({
            label: bucket.label,
            income: Math.round(bucket.income),
            expenses: Math.round(bucket.expenses),
        }));
}

function computeCategoryBreakdown(transactions: NormalizedTransaction[]) {
    const map = new Map<string, { label: string; amount: number; color: string }>();
    let uncategorised = 0;

    transactions
        .filter((transaction) => transaction.type === 'expense')
        .forEach((transaction) => {
            if (transaction.category) {
                const key = transaction.category.id;
                if (!map.has(key)) {
                    map.set(key, {
                        label: transaction.category.name,
                        amount: 0,
                        color: transaction.category.color ?? '#64748b',
                    });
                }
                map.get(key)!.amount += transaction.amount;
            } else {
                uncategorised += transaction.amount;
            }
        });

    const result = Array.from(map.values()).sort((a, b) => b.amount - a.amount);
    if (uncategorised > 0) {
        result.push({
            label: 'Uncategorised',
            amount: uncategorised,
            color: '#94a3b8',
        });
    }
    return result;
}

function computeExpenseTotalsByCategory(transactions: NormalizedTransaction[]) {
    const totals = new Map<
        string,
        { id: string; name: string; amount: number; color: string | null }
    >();

    transactions
        .filter((transaction) => transaction.type === 'expense')
        .forEach((transaction) => {
            const key = transaction.category?.id ?? '__uncategorised__';
            if (!totals.has(key)) {
                totals.set(key, {
                    id: key,
                    name: transaction.category?.name ?? 'Uncategorised',
                    amount: 0,
                    color: transaction.category?.color ?? '#94a3b8',
                });
            }
            totals.get(key)!.amount += transaction.amount;
        });

    return totals;
}

function getPreviousRange(startISO: string, endISO: string) {
    const startDate = new Date(startISO);
    const endDate = new Date(endISO);
    const totalDays = Math.max(1, inclusiveDayDiff(startDate, endDate));

    const previousEnd = new Date(startDate);
    previousEnd.setDate(previousEnd.getDate() - 1);

    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - (totalDays - 1));

    return {
        start: toISODate(previousStart),
        end: toISODate(previousEnd),
    };
}

export default async function OverviewPage({ searchParams }: PageProps) {
    const supabase = await createSupabaseServerComponentClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/sign-in');
    }

    const resolvedSearchParams = (await searchParams) ?? {};
    const categoryId = parseParam(resolvedSearchParams, 'category');
    const paymentMethod = parseParam(resolvedSearchParams, 'payment');
    const search = parseParam(resolvedSearchParams, 'search');
    const intervalParam = parseParam(resolvedSearchParams, 'interval');
    const summaryInterval: 'month' | 'week' | 'day' =
        intervalParam === 'week'
            ? 'week'
            : intervalParam === 'day'
                ? 'day'
                : 'month';

    const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('currency_code, display_name, pay_cycle_start_day')
        .eq('user_id', user.id)
        .maybeSingle();

    if (settingsError && settingsError.code !== 'PGRST116') {
        throw settingsError;
    }

    let currencyCode = settingsData?.currency_code ?? 'USD';
    let payCycleStartDay = settingsData?.pay_cycle_start_day ?? 1;
    if (!settingsData) {
        const { data: insertedSettings } = await supabase
            .from('user_settings')
            .upsert(
                { user_id: user.id, currency_code: currencyCode, pay_cycle_start_day: payCycleStartDay },
                { onConflict: 'user_id' },
            )
            .select('currency_code, pay_cycle_start_day')
            .maybeSingle();
        currencyCode = insertedSettings?.currency_code ?? currencyCode;
        payCycleStartDay = insertedSettings?.pay_cycle_start_day ?? payCycleStartDay;
    }

    const today = new Date();
    const defaultCycleKey = currentCycleKeyForDate(today, payCycleStartDay);
    const defaultCycleRange = getCycleRange(defaultCycleKey, payCycleStartDay);
    const defaultStart = defaultCycleRange.startISO;
    const defaultEnd = defaultCycleRange.endISOInclusive;

    const start = parseParam(resolvedSearchParams, 'start') ?? defaultStart;
    const end = parseParam(resolvedSearchParams, 'end') ?? defaultEnd;
  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  });

  const formatCurrencyAmount = (value: number) =>
    currencyFormatter.format(Math.round(value));

    const buildTransactionsQuery = (rangeStart: string, rangeEnd: string) => {
        let query = supabase
            .from('transactions')
            .select(
                `
        id,
        amount,
        type,
        currency_code,
        occurred_on,
        payment_method,
        notes,
        category_id,
        categories (id, name, type, icon, color)
      `,
            )
            .eq('user_id', user.id)
            .gte('occurred_on', rangeStart)
            .lte('occurred_on', rangeEnd);

        if (categoryId) {
            query = query.eq('category_id', categoryId);
        }
        if (paymentMethod && isPaymentMethod(paymentMethod)) {
            query = query.eq('payment_method', paymentMethod);
        }
        if (search && search.trim().length > 0) {
            const term = `%${search.trim().replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
            query = query.or(`notes.ilike.${term},categories.name.ilike.${term}`);
        }

        return query.order('occurred_on', { ascending: false });
    };

    const { start: previousStart, end: previousEnd } = getPreviousRange(
        start,
        end,
    );

    const [
        categoriesResponse,
        currentTransactionsResponse,
        previousTransactionsResponse,
    ] = await Promise.all([
        supabase
            .from('categories')
            .select('id, name, type, icon, color')
            .eq('user_id', user.id)
            .order('name', { ascending: true }),
        buildTransactionsQuery(start, end),
        buildTransactionsQuery(previousStart, previousEnd),
    ]);

    if (categoriesResponse.error) {
        throw categoriesResponse.error;
    }
    if (currentTransactionsResponse.error) {
        throw currentTransactionsResponse.error;
    }
    if (previousTransactionsResponse.error) {
        throw previousTransactionsResponse.error;
    }

    const categories = (categoriesResponse.data ?? []) as CategoryRow[];
    const transactions: TransactionRow[] =
        (currentTransactionsResponse.data ?? []) as TransactionRow[];
    const previousTransactions: TransactionRow[] =
        (previousTransactionsResponse.data ?? []) as TransactionRow[];

    const categoryOptionsForFilters = categories.map((category) => ({
        id: category.id,
        name: category.name,
        type: category.type,
    }));

    const categoryOptionsForEditing = categories.map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        type: category.type,
    }));

    const normalizedTransactions = normalizeTransactions(
        transactions,
        currencyCode,
    );
    const previousNormalizedTransactions = normalizeTransactions(
        previousTransactions,
        currencyCode,
    );

    const totalIncome = normalizedTransactions
        .filter((transaction) => transaction.type === 'income')
        .reduce((sum, transaction) => sum + transaction.amount, 0);
    const totalExpenses = normalizedTransactions
        .filter((transaction) => transaction.type === 'expense')
        .reduce((sum, transaction) => sum + transaction.amount, 0);
    const balance = totalIncome - totalExpenses;

    const timelinePoints = computeTimeline(
        normalizedTransactions,
        summaryInterval,
    );
    const categoryBreakdown = computeCategoryBreakdown(normalizedTransactions);
    const latestTransactions = normalizedTransactions.slice(0, 8);

    const currentExpenseTotals = computeExpenseTotalsByCategory(
        normalizedTransactions,
    );
    const previousExpenseTotals = computeExpenseTotalsByCategory(
        previousNormalizedTransactions,
    );

    const insights: string[] = [];

    const categoryChanges = Array.from(currentExpenseTotals.values())
        .map((current) => {
            const previousAmount = previousExpenseTotals.get(current.id)?.amount ?? 0;
            const diff = current.amount - previousAmount;
            const ratio = previousAmount > 0 ? diff / previousAmount : Infinity;
            return {
                id: current.id,
                name: current.name,
                diff,
                ratio,
                current: current.amount,
                previous: previousAmount,
            };
        })
        .filter((entry) => entry.diff > 0 && entry.current > 25)
        .sort((a, b) => {
            const ratioDiff = (b.ratio === Infinity ? 999 : b.ratio) - (a.ratio === Infinity ? 999 : a.ratio);
            if (ratioDiff !== 0) {
                return ratioDiff;
            }
            return b.diff - a.diff;
        })
        .slice(0, 3);

    categoryChanges.forEach((entry) => {
        if (entry.ratio === Infinity) {
            insights.push(
                `${entry.name} is a new expense this period at ${formatCurrencyAmount(entry.current)}.`,
            );
        } else if (entry.ratio >= 0.15) {
            insights.push(
                `${entry.name} spending increased by ${Math.round(entry.ratio * 100)}% (${formatCurrencyAmount(entry.previous)} → ${formatCurrencyAmount(entry.current)}).`,
            );
        }
    });

    if (categoryBreakdown.length) {
        const topCategory = categoryBreakdown[0];
        insights.push(
            `${topCategory.label} is your top spending category this period at ${formatCurrencyAmount(topCategory.amount)}.`,
        );
    }

    if (totalIncome > 0) {
        const ratio = totalExpenses / totalIncome;
        if (ratio >= 0.9) {
            insights.push(
                `Expenses account for ${Math.round(ratio * 100)}% of your income. Consider reducing discretionary spending.`,
            );
        }
    }

    const rangeStartDate = new Date(start);
    const rangeEndDate = new Date(end);
    const totalPeriodDays = Math.max(1, inclusiveDayDiff(rangeStartDate, rangeEndDate));
    const todayDate = new Date();
    const observedEnd = todayDate < rangeEndDate ? todayDate : rangeEndDate;
    const observedDays = Math.max(1, inclusiveDayDiff(rangeStartDate, observedEnd));

    if (observedDays < totalPeriodDays && totalExpenses > 0) {
        const projectedExpenses = (totalExpenses / observedDays) * totalPeriodDays;
        if (projectedExpenses > totalExpenses + 50) {
            insights.push(
                `At the current pace you may spend about ${formatCurrencyAmount(
                    projectedExpenses,
                )} on expenses this period (currently ${formatCurrencyAmount(totalExpenses)}).`,
            );
        }
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <MobileNav />

            <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-6">
                <DashboardFilters
                    categories={categoryOptionsForFilters}
                    initialFilters={{
                        start: start ?? '',
                        end: end ?? '',
                        categoryId: categoryId ?? '',
                        paymentMethod: paymentMethod ?? '',
                        search: search ?? '',
                    }}
                    summaryInterval={summaryInterval}
                />

        <DashboardSummaryCards
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          balance={balance}
          transactionCount={normalizedTransactions.length}
          currencyCode={currencyCode}
        />

                {insights.length ? (
                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <h2 className="text-base font-semibold text-slate-900">
                            Smart insights
                        </h2>
                        <ul className="mt-2 space-y-2 text-sm text-slate-700">
                            {insights.map((insight, index) => (
                                <li key={index} className="flex items-start gap-2">
                                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                                    <span>{insight}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                ) : null}

                <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
                    <SummaryChart interval={summaryInterval} points={timelinePoints} />
                    <CategoryPieChart data={categoryBreakdown} />
                </section>

                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold text-slate-900">
                            {normalizedTransactions.length
                                ? 'Filtered transactions'
                                : 'No transactions'}
                        </h2>
                        <p className="text-xs text-slate-500">
                            Showing {latestTransactions.length} of {normalizedTransactions.length}
                        </p>
                    </div>
                    {latestTransactions.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
                            Adjust filters or add new transactions to see them here.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {latestTransactions.map((transaction) => (
                                <TransactionItem
                                    key={transaction.id}
                                    transaction={transaction}
                                    categories={categoryOptionsForEditing}
                                    enableEditing={false}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
