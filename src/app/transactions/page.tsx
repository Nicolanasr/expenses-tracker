import { redirect } from 'next/navigation';

import { CreateTransactionForm } from '@/app/_components/create-transaction-form';
import { MobileNav } from '@/app/_components/mobile-nav';
import { TransactionsPaginatedList } from '@/app/_components/transactions-paginated-list';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { fetchTransactionsPage } from '@/lib/transactions/pagination';

export const dynamic = 'force-dynamic';

const PAYMENT_METHODS = ['card', 'cash', 'transfer', 'other'] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const SORT_FIELDS = {
    recent: { column: 'occurred_on', ascending: false, label: 'Newest first' },
    oldest: { column: 'occurred_on', ascending: true, label: 'Oldest first' },
    amount_desc: { column: 'amount', ascending: false, label: 'Amount: high to low' },
    amount_asc: { column: 'amount', ascending: true, label: 'Amount: low to high' },
} as const;
const DEFAULT_TRANSACTIONS_PAGE_SIZE = 14;

type Category = {
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: string | null;
    color: string | null;
};

function parseParam(params: Record<string, string | string[] | undefined>, key: string) {
    const raw = params[key];
    if (!raw) return undefined;
    if (Array.isArray(raw)) return raw[0];
    return raw;
}

function parseCategoryParams(params: Record<string, string | string[] | undefined>, key: string) {
    const raw = params[key];
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    }
    return raw.trim().length ? [raw] : [];
}

function parseNumberParam(value?: string) {
    if (value === undefined) {
        return undefined;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
        return undefined;
    }
    return parsed;
}

export default async function TransactionsPage({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
    const supabase = await createSupabaseServerComponentClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/sign-in');
    }

    const resolvedSearchParams = (await searchParams) ?? {};

    const today = new Date();
    const defaultEnd = today.toISOString().slice(0, 10);
    const defaultStartDate = new Date(today);
    defaultStartDate.setDate(defaultStartDate.getDate() - 29);
    const defaultStart = defaultStartDate.toISOString().slice(0, 10);

    const start = parseParam(resolvedSearchParams, 'start') ?? defaultStart;
    const end = parseParam(resolvedSearchParams, 'end') ?? defaultEnd;
    const categoryFilters = parseCategoryParams(resolvedSearchParams, 'category');
    const categoryFilter = categoryFilters[0];
    const paymentFilter = parseParam(resolvedSearchParams, 'payment');
    const typeFilter = parseParam(resolvedSearchParams, 'type');
    const minAmount = parseParam(resolvedSearchParams, 'minAmount');
    const maxAmount = parseParam(resolvedSearchParams, 'maxAmount');
    const sortParam = parseParam(resolvedSearchParams, 'sort') ?? 'recent';
    const pageParam = parseParam(resolvedSearchParams, 'page');

    const minAmountValue = parseNumberParam(minAmount);
    const maxAmountValue = parseNumberParam(maxAmount);
    const sanitizedPaymentMethod =
        paymentFilter && (PAYMENT_METHODS as readonly string[]).includes(paymentFilter)
            ? (paymentFilter as PaymentMethod)
            : undefined;
    const sanitizedType = typeFilter === 'income' || typeFilter === 'expense' ? (typeFilter as 'income' | 'expense') : undefined;
    const sortKey = Object.prototype.hasOwnProperty.call(SORT_FIELDS, sortParam)
        ? (sortParam as keyof typeof SORT_FIELDS)
        : 'recent';
    const parsedPage = parseNumberParam(pageParam);
    const page = Math.max(1, parsedPage ? Math.floor(parsedPage) : 1);

    const { data: settings } = await supabase
        .from('user_settings')
        .select('currency_code')
        .eq('user_id', user.id)
        .maybeSingle();

    let currencyCode = settings?.currency_code ?? 'USD';
    if (!settings) {
        const { data: inserted } = await supabase
            .from('user_settings')
            .upsert({ user_id: user.id, currency_code: currencyCode }, { onConflict: 'user_id' })
            .select('currency_code')
            .maybeSingle();
        currencyCode = inserted?.currency_code ?? currencyCode;
    }

    const { data: categoryRows, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name, type, icon, color')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

    if (categoriesError) {
        throw categoriesError;
    }

    const categories = (categoryRows ?? []) as Category[];
    const nameToId = new Map(categories.map((category) => [category.name, category.id]));
    const categoryIdSet = new Set(categories.map((category) => category.id));
    const normalizedCategoryFilters = categoryFilters
        .map((value) => {
            if (categoryIdSet.has(value)) {
                return value;
            }
            return nameToId.get(value);
        })
        .filter((value): value is string => Boolean(value));

    const transactionFiltersForList = {
        start,
        end,
        categoryIds: normalizedCategoryFilters.length ? normalizedCategoryFilters : undefined,
        paymentMethod: sanitizedPaymentMethod,
        type: sanitizedType,
        minAmount: minAmountValue,
        maxAmount: maxAmountValue,
        sort: sortKey,
    };

    const paginated = await fetchTransactionsPage(supabase, user.id, {
        page,
        pageSize: DEFAULT_TRANSACTIONS_PAGE_SIZE,
        filters: transactionFiltersForList,
    });

    const normalizedTransactions = paginated.rows.map((transaction) => ({
        id: transaction.id,
        amount: Number(transaction.amount ?? 0),
        type: transaction.type,
        currencyCode: transaction.currency_code ?? currencyCode,
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

    const categoryOptions = (categories ?? []).map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        type: category.type,
    }));

    const filterControls = (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <details>
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">Filters</summary>
                <form className="mt-4 grid gap-3 sm:grid-cols-2" method="get">
                    <label className="text-sm font-semibold text-slate-700">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Start date</span>
                        <input
                            type="date"
                            name="start"
                            defaultValue={start}
                            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">End date</span>
                        <input
                            type="date"
                            name="end"
                            defaultValue={end}
                            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Category</span>
                        <select
                            name="category"
                            defaultValue={categoryFilter ?? ''}
                            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        >
                            <option value="">All categories</option>
                            {(categories ?? []).map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Payment method</span>
                        <select
                            name="payment"
                            defaultValue={paymentFilter ?? ''}
                            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        >
                            <option value="">All methods</option>
                            {PAYMENT_METHODS.map((method) => (
                                <option key={method} value={method}>
                                    {method}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Type</span>
                        <select
                            name="type"
                            defaultValue={typeFilter ?? ''}
                            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        >
                            <option value="">Income & expense</option>
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                        </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Min amount</span>
                        <input
                            type="number"
                            step="0.01"
                            name="minAmount"
                            defaultValue={minAmount ?? ''}
                            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Max amount</span>
                        <input
                            type="number"
                            step="0.01"
                            name="maxAmount"
                            defaultValue={maxAmount ?? ''}
                            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Sort</span>
                        <select
                            name="sort"
                            defaultValue={sortParam}
                            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        >
                            {Object.entries(SORT_FIELDS).map(([value, config]) => (
                                <option key={value} value={value}>
                                    {config.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="sm:col-span-2 flex gap-3">
                        <button
                            type="submit"
                            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                            Apply filters
                        </button>
                        <a
                            href="/transactions"
                            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600"
                        >
                            Reset
                        </a>
                    </div>
                </form>
            </details>
        </section>
    );

    return (
        <div className="min-h-screen bg-slate-50">
            <MobileNav />

            <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-6">
                <section>
                    <CreateTransactionForm categories={categories ?? []} />
                </section>

                <TransactionsPaginatedList
                    initialTransactions={normalizedTransactions}
                    totalCount={paginated.total}
                    pageSize={DEFAULT_TRANSACTIONS_PAGE_SIZE}
                    page={page}
                    filters={transactionFiltersForList}
                    categories={categoryOptions}
                    allowEditing
                    title="All transactions"
                    emptyMessage="Nothing here yet. Adjust the filters or add a transaction above."
                    renderFilters={filterControls}
                />
            </main>
        </div>
    );
}
