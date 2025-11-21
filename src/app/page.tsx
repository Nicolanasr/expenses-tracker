import { DashboardFilters } from '@/app/_components/dashboard-filters';
import { DashboardSummaryCards } from '@/app/_components/dashboard-summary-cards';
import { MobileNav } from '@/app/_components/mobile-nav';
import { SummaryChart } from '@/app/_components/summary-chart';
import { CategoryPieChart } from '@/app/_components/category-pie-chart';
import { TransactionsPaginatedList } from '@/app/_components/transactions-paginated-list';
import { OfflineFallback } from '@/app/_components/offline-fallback';
import { LandingPage } from '@/app/_components/landing-page';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { currentCycleKeyForDate, getCycleRange } from '@/lib/pay-cycle';
import { getTopBudgetUsage } from '@/lib/budgets';

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
    updated_at: string;
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
    updatedAt: string;
    category: {
        id: string;
        name: string;
        icon: string | null;
        color: string | null;
        type: 'income' | 'expense';
    } | null;
};

type SavedFilter = {
    id: string;
    name: string;
    query: string;
};

const PAYMENT_METHODS = ['card', 'cash', 'transfer', 'other'] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const DEFAULT_TRANSACTIONS_PAGE_SIZE = 14;

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

function parseSavedFilters(value: unknown): SavedFilter[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const record = entry as Record<string, unknown>;
            if (typeof record.id !== 'string' || typeof record.name !== 'string' || typeof record.query !== 'string') {
                return null;
            }
            return {
                id: record.id,
                name: record.name,
                query: record.query,
            };
        })
        .filter((item): item is SavedFilter => Boolean(item));
}

function parseCategoryParams(params: SearchParams, key: string) {
    const raw = params?.[key];
    if (!raw) {
        return [];
    }
    if (Array.isArray(raw)) {
        return raw.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    }
    return raw.trim().length ? [raw] : [];
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
        updatedAt: transaction.updated_at,
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

export default async function OverviewPage({ searchParams }: PageProps) {
    const supabase = await createSupabaseServerComponentClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError?.name === "AuthRetryableFetchError") {
        return <OfflineFallback />;
    }

    if (!user) {
        return <LandingPage />;
    }

    if (userError) {
        return <OfflineFallback />;
    }

    const resolvedSearchParams = (await searchParams) ?? {};

    const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('currency_code, display_name, pay_cycle_start_day, saved_filters')
        .eq('user_id', user!.id)
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
                { user_id: user!.id, currency_code: currencyCode, pay_cycle_start_day: payCycleStartDay },
                { onConflict: 'user_id' },
            )
            .select('currency_code, pay_cycle_start_day')
            .maybeSingle();
        currencyCode = insertedSettings?.currency_code ?? currencyCode;
        payCycleStartDay = insertedSettings?.pay_cycle_start_day ?? payCycleStartDay;
    }

    const savedFilters = parseSavedFilters(settingsData?.saved_filters);

    const today = new Date();
    const defaultCycleKey = currentCycleKeyForDate(today, payCycleStartDay);
    const defaultCycleRange = getCycleRange(defaultCycleKey, payCycleStartDay);
    const defaultStart = defaultCycleRange.startISO;
    const defaultEnd = defaultCycleRange.endISOInclusive;

    const start = parseParam(resolvedSearchParams, 'start') ?? defaultStart;
    const end = parseParam(resolvedSearchParams, 'end') ?? defaultEnd;
    const categoryNames = parseCategoryParams(resolvedSearchParams, 'category');
    const paymentMethod = parseParam(resolvedSearchParams, 'payment');
    const search = parseParam(resolvedSearchParams, 'search');
    const intervalParam = parseParam(resolvedSearchParams, 'interval');
    const pageParam = parseParam(resolvedSearchParams, 'page');
    const summaryInterval: 'month' | 'week' | 'day' =
        intervalParam === 'week'
            ? 'week'
            : intervalParam === 'day'
                ? 'day'
                : 'month';

    const { data: categoryRows, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name, type, icon, color')
        .eq('user_id', user!.id)
        .order('name', { ascending: true });

    if (categoriesError) {
        throw categoriesError;
    }

    const categories = (categoryRows ?? []) as CategoryRow[];
    const nameToId = new Map(categories.map((category) => [category.name, category.id]));
    const selectedCategoryIds = categoryNames
        .map((name) => nameToId.get(name))
        .filter((value): value is string => Boolean(value));

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
        updated_at,
        category_id,
        categories (id, name, type, icon, color)
      `,
            )
            .eq('user_id', user!.id)
            .gte('occurred_on', rangeStart)
            .lte('occurred_on', rangeEnd);

        if (selectedCategoryIds.length) {
            query = query.in('category_id', selectedCategoryIds);
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

    const [currentTransactionsResponse] = await Promise.all([
        buildTransactionsQuery(start, end),
    ]);

    if (currentTransactionsResponse.error) {
        throw currentTransactionsResponse.error;
    }
    const transactions: TransactionRow[] =
        (currentTransactionsResponse.data ?? []) as TransactionRow[];

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
    const totalTransactionsCount = normalizedTransactions.length;
    const paginatedTotalPages = Math.max(
        1,
        Math.ceil(totalTransactionsCount / DEFAULT_TRANSACTIONS_PAGE_SIZE),
    );
    const parsedPageParam = pageParam ? Number(pageParam) : 1;
    const initialPage = Math.min(
        paginatedTotalPages,
        Math.max(1, Number.isNaN(parsedPageParam) ? 1 : Math.floor(parsedPageParam)),
    );
    const initialTransactionsPage = normalizedTransactions.slice(
        (initialPage - 1) * DEFAULT_TRANSACTIONS_PAGE_SIZE,
        initialPage * DEFAULT_TRANSACTIONS_PAGE_SIZE,
    );
    const transactionsListFilters = {
        start,
        end,
        categoryIds: selectedCategoryIds.length ? selectedCategoryIds : undefined,
        paymentMethod: paymentMethod ?? undefined,
        search: search ?? undefined,
        sort: 'recent',
    };
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

    const budgetUsage = await getTopBudgetUsage(defaultCycleKey, 50);
    const topBudgetDisplay = budgetUsage.slice(0, 3);
    const remainingBudgets = budgetUsage.slice(3);

    return (
        <div className="min-h-screen bg-slate-50">
            <MobileNav />

            <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-6">
                <DashboardFilters
                    categories={categoryOptionsForFilters}
                    savedFilters={savedFilters}
                    initialFilters={{
                        start: start ?? '',
                        end: end ?? '',
                        categoryNames,
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

                {budgetUsage.length ? (
                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <h2 className="text-base font-semibold text-slate-900">Budget health</h2>
                        <p className="text-xs text-slate-500">Top categories by % used this cycle.</p>
                        <div className="mt-3 space-y-2">
                            {topBudgetDisplay.map((row) => {
                                const pct = Math.round(row.used_pct ?? 0);
                                const pctLabel = `${pct}%`;
                                const barColor =
                                    pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
                                return (
                                    <div key={row.category_id} className="space-y-1 rounded-xl border border-slate-100 p-3">
                                        <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                                            <span>{categories.find((c) => c.id === row.category_id)?.name ?? 'Category'}</span>
                                            <span className="text-xs text-slate-500">{pctLabel}</span>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-slate-100">
                                            <div
                                                className={`h-2 rounded-full ${barColor}`}
                                                style={{ width: `${Math.min(pct, 100)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-500">
                                            <span>Budget {(row.budget_cents / 100).toFixed(2)}</span>
                                            <span>Spent {(row.spent_cents / 100).toFixed(2)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {remainingBudgets.length ? (
                            <details className="mt-3">
                                <summary className="cursor-pointer text-xs font-semibold text-indigo-600">
                                    Show all budget insights
                                </summary>
                                <div className="mt-2 space-y-2">
                                    {remainingBudgets.map((row) => {
                                        const pct = Math.round(row.used_pct ?? 0);
                                        const pctLabel = `${pct}%`;
                                        const barColor =
                                            pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
                                        return (
                                            <div key={row.category_id} className="space-y-1 rounded-xl border border-slate-100 p-3">
                                                <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                                                    <span>{categories.find((c) => c.id === row.category_id)?.name ?? 'Category'}</span>
                                                    <span className="text-xs text-slate-500">{pctLabel}</span>
                                                </div>
                                                <div className="h-2 w-full rounded-full bg-slate-100">
                                                    <div
                                                        className={`h-2 rounded-full ${barColor}`}
                                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                                    />
                                                </div>
                                                <div className="flex justify-between text-xs text-slate-500">
                                                    <span>Budget {(row.budget_cents / 100).toFixed(2)}</span>
                                                    <span>Spent {(row.spent_cents / 100).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </details>
                        ) : null}
                    </section>
                ) : null}

                <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
                    <SummaryChart interval={summaryInterval} points={timelinePoints} />
                    <CategoryPieChart data={categoryBreakdown} />
                </section>


                <TransactionsPaginatedList
                    initialTransactions={initialTransactionsPage}
                    totalCount={totalTransactionsCount}
                    pageSize={DEFAULT_TRANSACTIONS_PAGE_SIZE}
                    page={initialPage}
                    filters={transactionsListFilters}
                    categories={categoryOptionsForEditing}
                    title="Transactions"
                    emptyMessage="No transactions for this period yet."
                />
            </main>
        </div>
    );
}
