import { Suspense } from 'react';

import { AccountBalanceCards } from '@/app/_components/account-balance-cards';
import { DashboardFilters } from '@/app/_components/dashboard-filters';
import { MobileNav } from '@/app/_components/mobile-nav';
import { SummaryChart } from '@/app/_components/summary-chart';
import { CategoryPieChart } from '@/app/_components/category-pie-chart';
import { TransactionsPaginatedList } from '@/app/_components/transactions-paginated-list';
import { OfflineFallback } from '@/app/_components/offline-fallback';
import { LandingPage } from '@/app/_components/landing-page';
import { BudgetHealthSection, BudgetHealthFallback } from '@/app/_components/budget-health-section';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { currentCycleKeyForDate, getCycleRange } from '@/lib/pay-cycle';
import { ALL_PAYMENT_METHODS, normalizePaymentMethod, type PaymentMethod } from '@/lib/payment-methods';

export const dynamic = 'force-dynamic';
const PERF_ENABLED = true;

function getTimeMs() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }
    return Date.now();
}

function perfLog(label: string, start: number | undefined) {
    if (!PERF_ENABLED || typeof start !== 'number') return;
    const duration = getTimeMs() - start;
    console.log(`[perf][overview] ${label}: ${duration}ms`);
}

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
    payment_method: 'cash' | 'card' | 'transfer' | 'bank_transfer' | 'account_transfer' | 'other';
    notes: string | null;
    category_id: string | null;
    categories: CategoryRow | null;
    updated_at: string;
    account_id: string | null;
    accounts: {
        id: string;
        name: string;
        type: string;
        institution: string | null;
    } | null;
    payee: string | null;
};

type AccountRow = {
    id: string;
    name: string;
    type: string;
    institution: string | null;
    starting_balance: number;
    default_payment_method: 'cash' | 'card' | 'transfer' | 'bank_transfer' | 'account_transfer' | 'other' | null;
};

type AccountOption = {
    id: string;
    name: string;
    type: string;
    institution: string | null;
    defaultPaymentMethod?: 'cash' | 'card' | 'transfer' | 'bank_transfer' | 'account_transfer' | 'other' | null;
};

type NormalizedTransaction = {
    id: string;
    amount: number;
    type: 'income' | 'expense';
    currencyCode: string;
    occurredOn: string;
    paymentMethod: PaymentMethod;
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
    accountId: string | null;
    account: AccountOption | null;
    payee: string | null;
};

type SavedFilter = {
    id: string;
    name: string;
    query: string;
};

const DEFAULT_TRANSACTIONS_PAGE_SIZE = 14;
const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000;
const SETTINGS_CACHE = new Map<
    string,
    { data: { currency_code: string | null; display_name: string | null; pay_cycle_start_day: number | null; saved_filters: unknown; budget_thresholds?: unknown }; ts: number }
>();

function isPaymentMethod(value: string): value is PaymentMethod {
    return (ALL_PAYMENT_METHODS as readonly string[]).includes(value);
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

function parseBudgetThresholds(value: unknown): Record<string, number[]> {
    if (!Array.isArray(value)) return {};
    const map = new Map<string, number[]>();
    value.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const record = entry as { categoryId?: unknown; levels?: unknown };
        if (typeof record.categoryId !== 'string' || !Array.isArray(record.levels)) return;
        const levels = record.levels
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0 && n <= 100)
            .map((n) => Math.round(n));
        if (levels.length) {
            map.set(
                record.categoryId,
                Array.from(new Set(levels)).sort((a, b) => a - b),
            );
        }
    });
    return Object.fromEntries(map.entries());
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
        paymentMethod: normalizePaymentMethod(transaction.payment_method),
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
        accountId: transaction.account_id ?? null,
        account: transaction.accounts
            ? {
                id: transaction.accounts.id,
                name: transaction.accounts.name,
                type: transaction.accounts.type,
                institution: transaction.accounts.institution,
            }
            : null,
        payee: transaction.payee ?? null,
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
    const pageStart = PERF_ENABLED ? getTimeMs() : undefined;
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
    const resolvedSearchParams: SearchParams = searchParams ? await searchParams : {};

    const settingsStart = PERF_ENABLED ? getTimeMs() : undefined;
    const now = getTimeMs();
    const cachedSettings = SETTINGS_CACHE.get(user.id);
    let settingsData: { currency_code: string | null; display_name: string | null; pay_cycle_start_day: number | null; saved_filters: unknown; budget_thresholds?: unknown } | null = null;

    if (cachedSettings && now - cachedSettings.ts < SETTINGS_CACHE_TTL_MS) {
        settingsData = cachedSettings.data;
    } else {
        const { data, error } = await supabase
            .from('user_settings')
            .select('currency_code, display_name, pay_cycle_start_day, saved_filters, budget_thresholds')
            .eq('user_id', user!.id)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        if (!data) {
            const { data: insertedSettings } = await supabase
                .from('user_settings')
                .upsert(
                    { user_id: user!.id, currency_code: 'USD', pay_cycle_start_day: 1, budget_thresholds: [] },
                    { onConflict: 'user_id' },
                )
                .select('currency_code, display_name, pay_cycle_start_day, saved_filters, budget_thresholds')
                .maybeSingle();
            settingsData = insertedSettings ?? { currency_code: 'USD', display_name: null, pay_cycle_start_day: 1, saved_filters: [], budget_thresholds: [] };
        } else {
            settingsData = data;
        }

        SETTINGS_CACHE.set(user.id, { data: settingsData, ts: now });
    }

    perfLog('settings', settingsStart);

    const currencyCode = settingsData?.currency_code ?? 'USD';
    const payCycleStartDay = settingsData?.pay_cycle_start_day ?? 1;
    const savedFilters = parseSavedFilters(settingsData?.saved_filters);
    const budgetThresholds = parseBudgetThresholds(settingsData?.budget_thresholds);

    const today = new Date();
    const defaultCycleKey = currentCycleKeyForDate(today, payCycleStartDay);
    const defaultCycleRange = getCycleRange(defaultCycleKey, payCycleStartDay);
    const defaultStart = defaultCycleRange.startISO;
    const defaultEnd = defaultCycleRange.endISOInclusive;

    const start = parseParam(resolvedSearchParams, 'start') ?? defaultStart;
    const end = parseParam(resolvedSearchParams, 'end') ?? defaultEnd;
    const categoryNames = parseCategoryParams(resolvedSearchParams, 'category');
    const paymentMethod = parseParam(resolvedSearchParams, 'payment');
    const sanitizedPaymentMethod = paymentMethod && isPaymentMethod(paymentMethod) ? paymentMethod : undefined;
    const search = parseParam(resolvedSearchParams, 'search');
    const intervalParam = parseParam(resolvedSearchParams, 'interval');
    const pageParam = parseParam(resolvedSearchParams, 'page');
    const summaryInterval: 'month' | 'week' | 'day' =
        intervalParam === 'week'
            ? 'week'
            : intervalParam === 'day'
                ? 'day'
                : 'month';

    const accountParam = parseParam(resolvedSearchParams, 'account');

    const listStart = PERF_ENABLED ? getTimeMs() : undefined;
    const [
        { data: categoryRows, error: categoriesError },
        { data: accountRows, error: accountsError },
    ] = await Promise.all([
        supabase
            .from('categories')
            .select('id, name, type, icon, color')
            .eq('user_id', user!.id)
            .is('deleted_at', null)
            .order('name', { ascending: true }),
        supabase
            .from('accounts')
            .select('id, name, type, institution, starting_balance, default_payment_method')
            .eq('user_id', user!.id)
            .is('deleted_at', null)
            .order('name', { ascending: true }),
    ]);
    perfLog('categories + accounts', listStart);

    if (categoriesError) {
        throw categoriesError;
    }
    if (accountsError) {
        throw accountsError;
    }

    const categories = (categoryRows ?? []) as CategoryRow[];
    let accounts = (accountRows ?? []) as AccountRow[];
    if (accounts.length === 0) {
        const { data: insertedAccount, error: insertAccountError } = await supabase
            .from('accounts')
            .insert({
                user_id: user!.id,
                name: 'Main account',
                type: 'checking',
            })
            .select('id, name, type, institution, starting_balance, default_payment_method')
            .single();
        if (insertAccountError) {
            console.error(insertAccountError);
        } else if (insertedAccount) {
            accounts = [insertedAccount as AccountRow];
        }
    }

    const nameToId = new Map(categories.map((category) => [category.name, category.id]));
    const selectedCategoryIds = categoryNames
        .map((name) => nameToId.get(name))
        .filter((value): value is string => Boolean(value));

    const accountOptionsForFilters = accounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        institution: account.institution,
        defaultPaymentMethod: account.default_payment_method ? normalizePaymentMethod(account.default_payment_method) : null,
    }));
    const accountNameToId = new Map(accountOptionsForFilters.map((account) => [account.name, account.id]));
    const selectedAccountId = accountParam
        ? accountOptionsForFilters.some((account) => account.id === accountParam)
            ? accountParam
            : accountNameToId.get(accountParam) ?? null
        : null;

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
        payee,
        account_id,
        accounts (id, name, type, institution),
        categories (id, name, type, icon, color)
      `,
            )
            .eq('user_id', user!.id)
            .is('deleted_at', null)
            .gte('occurred_on', rangeStart)
            .lte('occurred_on', rangeEnd);

        if (selectedCategoryIds.length) {
            query = query.in('category_id', selectedCategoryIds);
        }
        if (selectedAccountId) {
            query = query.eq('account_id', selectedAccountId);
        }
        if (sanitizedPaymentMethod) {
            query = query.eq('payment_method', sanitizedPaymentMethod);
        }
        if (search && search.trim().length > 0) {
            const term = `%${search.trim().replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
            query = query.or(`notes.ilike.${term},categories.name.ilike.${term}`);
        }

        return query.order('occurred_on', { ascending: false });
    };

    const txStart = PERF_ENABLED ? getTimeMs() : undefined;
    const [currentTransactionsResponse, accountTransactionsResponse] = await Promise.all([
        buildTransactionsQuery(start, end),
        supabase
            .from('transactions')
            .select('account_id, amount, type')
            .eq('user_id', user!.id)
            .is('deleted_at', null)
            .not('account_id', 'is', null),
    ]);
    perfLog('transactions fetch', txStart);

    if (currentTransactionsResponse.error) {
        throw currentTransactionsResponse.error;
    }
    if (accountTransactionsResponse.error) {
        throw accountTransactionsResponse.error;
    }
    const transactions: TransactionRow[] = (currentTransactionsResponse.data ?? []) as TransactionRow[];
    const accountTransactions = accountTransactionsResponse.data ?? [];

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

    const normalizedTransactions = normalizeTransactions(transactions, currencyCode);
    const reportTransactions = normalizedTransactions.filter((transaction) => transaction.paymentMethod !== 'account_transfer');
    const payeeNames = Array.from(new Set(normalizedTransactions.map((transaction) => transaction.payee).filter((name): name is string => Boolean(name))));
    const totalTransactionsCount = normalizedTransactions.length;
    const paginatedTotalPages = Math.max(1, Math.ceil(totalTransactionsCount / DEFAULT_TRANSACTIONS_PAGE_SIZE));
    const parsedPageParam = pageParam ? Number(pageParam) : 1;
    const initialPage = Math.min(paginatedTotalPages, Math.max(1, Number.isNaN(parsedPageParam) ? 1 : Math.floor(parsedPageParam)));
    const initialTransactionsPage = normalizedTransactions.slice((initialPage - 1) * DEFAULT_TRANSACTIONS_PAGE_SIZE, initialPage * DEFAULT_TRANSACTIONS_PAGE_SIZE);
    const transactionsListFilters = {
        start,
        end,
        categoryIds: selectedCategoryIds.length ? selectedCategoryIds : undefined,
        paymentMethod: sanitizedPaymentMethod,
        accountId: selectedAccountId ?? undefined,
        search: search ?? undefined,
        sort: 'recent',
    };

    const accountBalances = accounts.map((account) => {
        const startingBalance = Number(account.starting_balance ?? 0);
        const delta = accountTransactions.filter((tx) => tx.account_id === account.id).reduce((sum, tx) => {
            const amount = Number(tx.amount ?? 0);
            return tx.type === 'income' ? sum + amount : sum - amount;
        }, 0);
        return {
            id: account.id,
            name: account.name,
            type: account.type,
            institution: account.institution,
            balance: startingBalance + delta,
            currencyCode,
        };
    });

    perfLog('page total', pageStart);

    return (
        <div className="min-h-screen bg-slate-50">
            <MobileNav />

            <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-6">
                <DashboardFilters
                    categories={categoryOptionsForFilters}
                    accounts={accountOptionsForFilters}
                    savedFilters={savedFilters}
                    initialFilters={{
                        start: start ?? '',
                        end: end ?? '',
                        categoryNames,
                        paymentMethod: sanitizedPaymentMethod ?? '',
                        search: search ?? '',
                        accountId: selectedAccountId ?? '',
                    }}
                    summaryInterval={summaryInterval}
                />


                <Suspense fallback={<div className="h-28 rounded-2xl border border-slate-200 bg-white" />}>
                    {/* Summary cards intentionally streamed; using existing DashboardSummaryCards component */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total income</p>
                                <p className="text-2xl font-bold text-emerald-600">
                                    {reportTransactions
                                        .filter((t) => t.type === 'income')
                                        .reduce((sum, t) => sum + t.amount, 0)
                                        .toLocaleString('en-US', { style: 'currency', currency: currencyCode || 'USD' })}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total expenses</p>
                                <p className="text-2xl font-bold text-rose-600">
                                    {reportTransactions
                                        .filter((t) => t.type === 'expense')
                                        .reduce((sum, t) => sum + t.amount, 0)
                                        .toLocaleString('en-US', { style: 'currency', currency: currencyCode || 'USD' })}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Balance</p>
                                <p className="text-2xl font-bold text-slate-900">
                                    {(reportTransactions
                                        .filter((t) => t.type === 'income')
                                        .reduce((sum, t) => sum + t.amount, 0) -
                                        reportTransactions
                                            .filter((t) => t.type === 'expense')
                                            .reduce((sum, t) => sum + t.amount, 0))
                                        .toLocaleString('en-US', { style: 'currency', currency: currencyCode || 'USD' })}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transactions</p>
                                <p className="text-2xl font-bold text-slate-900">{reportTransactions.length}</p>
                            </div>
                        </div>
                    </div>
                </Suspense>

                <AccountBalanceCards accounts={accountBalances} />

                <Suspense fallback={<BudgetHealthFallback />}>
                    <BudgetHealthSection
                        userId={user.id}
                        userEmail={user.email ?? undefined}
                        cycleKey={defaultCycleKey}
                        cycleRangeStart={defaultCycleRange.startDate}
                        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
                        thresholdsByCategory={budgetThresholds}
                        notify={false}
                    />
                </Suspense>

                <Suspense fallback={<div className="grid gap-4 lg:grid-cols-[2fr,1fr]"><div className="h-64 rounded-2xl border border-slate-200 bg-white" /><div className="h-64 rounded-2xl border border-slate-200 bg-white" /></div>}>
                    <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
                        <SummaryChart interval={summaryInterval} points={computeTimeline(reportTransactions, summaryInterval)} />
                        <CategoryPieChart data={computeCategoryBreakdown(reportTransactions)} />
                    </section>
                </Suspense>


                <TransactionsPaginatedList
                    initialTransactions={initialTransactionsPage}
                    totalCount={totalTransactionsCount}
                    pageSize={DEFAULT_TRANSACTIONS_PAGE_SIZE}
                    page={initialPage}
                    filters={transactionsListFilters}
                    categories={categoryOptionsForEditing}
                    accounts={accountOptionsForFilters}
                    payees={payeeNames}
                    title="Transactions"
                    emptyMessage="No transactions for this period yet."
                />
            </main>
        </div>
    );
}
