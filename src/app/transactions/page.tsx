import { redirect } from 'next/navigation';

import { CreateTransactionForm } from '@/app/_components/create-transaction-form';
import { MobileNav } from '@/app/_components/mobile-nav';
import { TransactionsPaginatedList } from '@/app/_components/transactions-paginated-list';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { fetchTransactionsPage } from '@/lib/transactions/pagination';
import { TransactionsFilters } from '@/app/transactions/_components/transactions-filters';

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

    const nameLookup = new Map(categories.map((category) => [category.id, category.name]));
    const categoryNameSet = new Set(categories.map((category) => category.name));
    const initialCategoryNames = categoryFilters
        .map((entry) => {
            if (categoryNameSet.has(entry)) {
                return entry;
            }
            return nameLookup.get(entry);
        })
        .filter((entry): entry is string => Boolean(entry));

    const sharedInitialFilters = {
        start,
        end,
        categoryNames: initialCategoryNames,
        paymentMethod: paymentFilter ?? '',
        type: typeFilter ?? '',
        minAmount: minAmount ?? '',
        maxAmount: maxAmount ?? '',
        sort: sortParam ?? 'recent',
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <MobileNav />

            <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-6">
                <section>
                    <CreateTransactionForm categories={categories ?? []} />
                </section>

                {/* <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <details>
                        <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">
                            Filters
                        </summary>
                        <div className="mt-4">
                            <TransactionsFilters categories={categories} initialFilters={sharedInitialFilters} />
                        </div>
                    </details>
                </section> */}

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
                    renderFilters={
                        <details key="transactions-key">
                            <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">
                                Filters
                            </summary>
                            <div className="mt-4">
                                <TransactionsFilters
                                    categories={categories}
                                    initialFilters={sharedInitialFilters}
                                    compact
                                />
                            </div>
                        </details>
                    }
                />
            </main>
        </div>
    );
}
