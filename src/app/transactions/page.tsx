import { redirect } from 'next/navigation';

import { CreateTransactionForm } from '@/app/_components/create-transaction-form';
import { MobileNav } from '@/app/_components/mobile-nav';
import { TransactionsPaginatedList } from '@/app/_components/transactions-paginated-list';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { fetchTransactionsPage } from '@/lib/transactions/pagination';
import { ALL_PAYMENT_METHODS, normalizePaymentMethod, type PaymentMethod } from '@/lib/payment-methods';
import { TransactionsFilters } from '@/app/transactions/_components/transactions-filters';
import { TransactionsExportButton } from '@/app/transactions/_components/transactions-export-button';
import { OfflineFallback } from '../_components/offline-fallback';

export const dynamic = 'force-dynamic';

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

type TransactionRow = {
    id: string;
    amount: number;
    type: 'income' | 'expense';
    currency_code: string;
    occurred_on: string;
    payment_method: 'cash' | 'card' | 'transfer' | 'bank_transfer' | 'account_transfer' | 'other';
    notes: string | null;
    payee: string | null;
    category_id: string | null;
    categories: Category | null;
    account_id: string | null;
    accounts: {
        id: string;
        name: string;
        type: string;
        institution: string | null;
        default_payment_method: 'cash' | 'card' | 'transfer' | 'bank_transfer' | 'account_transfer' | 'other' | null;
    } | null;
    updated_at: string;
};

type AccountRow = {
    id: string;
    name: string;
    type: string;
    institution: string | null;
    default_payment_method: 'cash' | 'card' | 'transfer' | 'bank_transfer' | 'account_transfer' | 'other' | null;
};

type AccountOption = {
    id: string;
    name: string;
    type: string;
    institution: string | null;
    defaultPaymentMethod: 'cash' | 'card' | 'transfer' | 'bank_transfer' | 'account_transfer' | 'other' | null;
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
    let userId: string | null = null;
    let userError: Error | null = null;
    try {
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();
        userId = user?.id ?? null;
        userError = (error as Error) ?? null;
    } catch (error) {
        userId = null;
        userError = error as Error;
    }

    if (userError?.name == "AuthRetryableFetchError") {
        return <OfflineFallback />;
    }

    if (!userId) {
        redirect('/auth/sign-in');
    }


    const isOffline = !userId;

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
    const accountFilter = parseParam(resolvedSearchParams, 'account');

    const minAmountValue = parseNumberParam(minAmount);
    const maxAmountValue = parseNumberParam(maxAmount);
    const sanitizedPaymentMethod =
        paymentFilter && (ALL_PAYMENT_METHODS as readonly string[]).includes(paymentFilter)
            ? (paymentFilter as PaymentMethod)
            : undefined;
    const sanitizedType = typeFilter === 'income' || typeFilter === 'expense' ? (typeFilter as 'income' | 'expense') : undefined;
    const sortKey = Object.prototype.hasOwnProperty.call(SORT_FIELDS, sortParam)
        ? (sortParam as keyof typeof SORT_FIELDS)
        : 'recent';
    const parsedPage = parseNumberParam(pageParam);
    const page = Math.max(1, parsedPage ? Math.floor(parsedPage) : 1);

    let currencyCode = 'USD';
    if (!isOffline && userId) {
        const { data: settings } = await supabase
            .from('user_settings')
            .select('currency_code')
            .eq('user_id', userId)
            .maybeSingle();

        currencyCode = settings?.currency_code ?? 'USD';
        if (!settings) {
            const { data: inserted } = await supabase
                .from('user_settings')
                .upsert({ user_id: userId, currency_code: currencyCode }, { onConflict: 'user_id' })
                .select('currency_code')
                .maybeSingle();
            currencyCode = inserted?.currency_code ?? currencyCode;
        }
    }

    const categories: Category[] = [];
    const accounts: AccountRow[] = [];
    let paginated:
        | {
            rows: TransactionRow[];
            total: number;
        }
        | null = null;

    if (!isOffline) {
        const [
            { data: categoryRows, error: categoriesError },
            { data: accountRows, error: accountsError },
        ] = await Promise.all([
            supabase
                .from('categories')
                .select('id, name, type, icon, color')
                .eq('user_id', userId!)
                .order('name', { ascending: true }),
            supabase
                .from('accounts')
                .select('id, name, type, institution, default_payment_method')
                .eq('user_id', userId!)
                .order('name', { ascending: true }),
        ]);

        if (categoriesError) {
            throw categoriesError;
        }
        if (accountsError) {
            throw accountsError;
        }

        categories.push(...((categoryRows ?? []) as Category[]));

        const initialAccounts = (accountRows ?? []) as AccountRow[];
        if (initialAccounts.length === 0) {
            const { data: insertedAccount, error: insertAccountError } = await supabase
                .from('accounts')
                .insert({
                    user_id: userId!,
                    name: 'Main account',
                    type: 'checking',
                })
                .select('id, name, type, institution, default_payment_method')
                .single();
            if (insertAccountError) {
                console.error(insertAccountError);
            } else if (insertedAccount) {
                initialAccounts.push(insertedAccount as AccountRow);
            }
        }
        accounts.push(...initialAccounts);
    }

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

    const accountOptions: AccountOption[] = accounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        institution: account.institution,
        defaultPaymentMethod: account.default_payment_method ? normalizePaymentMethod(account.default_payment_method) : null,
    }));
    const accountNameToId = new Map(accountOptions.map((account) => [account.name, account.id]));
    const selectedAccountId = accountFilter
        ? accountOptions.some((account) => account.id === accountFilter)
            ? accountFilter
            : accountNameToId.get(accountFilter) ?? undefined
        : undefined;

    const transactionFiltersForList = {
        start,
        end,
        categoryIds: normalizedCategoryFilters.length ? normalizedCategoryFilters : undefined,
        paymentMethod: sanitizedPaymentMethod,
        type: sanitizedType,
        minAmount: minAmountValue,
        maxAmount: maxAmountValue,
        sort: sortKey,
        accountId: selectedAccountId,
    };

    if (!isOffline) {
        paginated = await fetchTransactionsPage(supabase, userId!, {
            page,
            pageSize: DEFAULT_TRANSACTIONS_PAGE_SIZE,
            filters: transactionFiltersForList,
        });
    }

    const normalizedTransactions = (paginated?.rows ?? []).map((transaction) => ({
        id: transaction.id,
        amount: Number(transaction.amount ?? 0),
        type: transaction.type,
        currencyCode: transaction.currency_code ?? currencyCode,
        occurredOn: transaction.occurred_on,
        paymentMethod: normalizePaymentMethod(transaction.payment_method),
        notes: transaction.notes,
        payee: transaction.payee ?? null,
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
        accountId: transaction.account_id ?? transaction.accounts?.id ?? null,
        account: transaction.accounts
            ? {
                id: transaction.accounts.id,
                name: transaction.accounts.name,
                type: transaction.accounts.type,
                institution: transaction.accounts.institution,
                defaultPaymentMethod: transaction.accounts.default_payment_method ?? null,
            }
            : null,
    }));
    const payees = Array.from(new Set(normalizedTransactions.map((transaction) => transaction.payee).filter((name): name is string => Boolean(name))));

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
        paymentMethod: sanitizedPaymentMethod ?? '',
        type: typeFilter ?? '',
        minAmount: minAmount ?? '',
        maxAmount: maxAmount ?? '',
        sort: sortParam ?? 'recent',
        accountId: selectedAccountId ?? '',
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <MobileNav />

            <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-6">
                <section>
                    <CreateTransactionForm categories={categories ?? []} accounts={accountOptions} payees={payees} />
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
                    totalCount={paginated?.total ?? 0}
                    pageSize={DEFAULT_TRANSACTIONS_PAGE_SIZE}
                    page={page}
                    filters={transactionFiltersForList}
                    categories={categoryOptions}
                    accounts={accountOptions}
                    payees={payees}
                    allowEditing={!isOffline}
                    preferCacheOnMount={isOffline}
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
                                    accounts={accountOptions}
                                    initialFilters={sharedInitialFilters}
                                    compact
                                />
                                <div className="mt-3 flex justify-end">
                                    <TransactionsExportButton filters={transactionFiltersForList} />
                                </div>
                            </div>
                        </details>
                    }
                />
            </main>
        </div>
    );
}
