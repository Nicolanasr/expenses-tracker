import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

import { MobileNav } from "@/app/_components/mobile-nav";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { ALL_PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment-methods";
import { RecurringTransactionsPanel, type RecurringRule } from "@/app/transactions/_components/recurring-transactions-panel";
import { processRecurringSchedules } from "@/lib/transactions/recurring";
import { OfflineFallback } from "../_components/offline-fallback";
import { FormSection } from "@/app/transactions/_components/form-section";
import { TransactionsSection } from "@/app/transactions/_components/transactions-section";

export const dynamic = "force-dynamic";
const PERF_ENABLED = true; // toggle to false to silence timing logs
const LOAD_RECURRING_BY_DEFAULT = false; // set true to always load recurring; false to skip unless requested via ?recurring=1
const DEFAULT_TRANSACTIONS_PAGE_SIZE = 14;

function getTimeMs() {
    // Prefer performance.now to avoid impure Date usage warnings.
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
        return performance.now();
    }
    return Date.now();
}

function perfLog(label: string, start: number | undefined) {
    if (!PERF_ENABLED || typeof start !== "number") return;
    const duration = getTimeMs() - start;
    console.log(`[perf][transactions] ${label}: ${duration}ms`);
}

const SORT_FIELDS = {
    recent: { column: "occurred_on", ascending: false, label: "Newest first" },
    oldest: { column: "occurred_on", ascending: true, label: "Oldest first" },
    amount_desc: { column: "amount", ascending: false, label: "Amount: high to low" },
    amount_asc: { column: "amount", ascending: true, label: "Amount: low to high" },
} as const;

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
        return raw.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
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
    const pageStart = PERF_ENABLED ? getTimeMs() : undefined;
    const supabase = await createSupabaseServerComponentClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError?.name === "AuthRetryableFetchError") {
        return <OfflineFallback />;
    }

    if (!user?.id) {
        redirect("/auth/sign-in");
    }

    const resolvedSearchParams = searchParams ? await searchParams : {};
    const sectionKey = JSON.stringify(resolvedSearchParams);

    const today = new Date();
    const defaultEnd = today.toISOString().slice(0, 10);
    const defaultStartDate = new Date(today);
    defaultStartDate.setDate(defaultStartDate.getDate() - 29);
    const defaultStart = defaultStartDate.toISOString().slice(0, 10);

    const start = parseParam(resolvedSearchParams, "start") ?? defaultStart;
    const end = parseParam(resolvedSearchParams, "end") ?? defaultEnd;
    const categoryFilters = parseCategoryParams(resolvedSearchParams, "category");
    const paymentFilter = parseParam(resolvedSearchParams, "payment");
    const typeFilter = parseParam(resolvedSearchParams, "type");
    const minAmount = parseParam(resolvedSearchParams, "minAmount");
    const maxAmount = parseParam(resolvedSearchParams, "maxAmount");
    const sortParam = parseParam(resolvedSearchParams, "sort") ?? "recent";
    const searchTerm = parseParam(resolvedSearchParams, "search");
    const pageParam = parseParam(resolvedSearchParams, "page");
    const accountFilter = parseParam(resolvedSearchParams, "account");
    const recurringParam = parseParam(resolvedSearchParams, "recurring");
    const loadRecurring = recurringParam === "1" || LOAD_RECURRING_BY_DEFAULT;

    const minAmountValue = parseNumberParam(minAmount);
    const maxAmountValue = parseNumberParam(maxAmount);
    const sanitizedPaymentMethod = paymentFilter && (ALL_PAYMENT_METHODS as readonly string[]).includes(paymentFilter) ? (paymentFilter as PaymentMethod) : undefined;
    const sanitizedType = typeFilter === "income" || typeFilter === "expense" ? (typeFilter as "income" | "expense") : undefined;
    const sortKey = Object.prototype.hasOwnProperty.call(SORT_FIELDS, sortParam) ? (sortParam as keyof typeof SORT_FIELDS) : "recent";
    const parsedPage = parseNumberParam(pageParam);
    const page = Math.max(1, parsedPage ? Math.floor(parsedPage) : 1);

    const transactionFiltersForList = {
        start,
        end,
        categoryIds: categoryFilters.length ? categoryFilters : undefined,
        paymentMethod: sanitizedPaymentMethod,
        search: searchTerm,
        type: sanitizedType,
        minAmount: minAmountValue,
        maxAmount: maxAmountValue,
        sort: sortKey,
        accountId: accountFilter || undefined,
    };

    const sharedInitialFilters = {
        start,
        end,
        categoryNames: categoryFilters,
        paymentMethod: sanitizedPaymentMethod ?? "",
        search: searchTerm ?? "",
        accountId: accountFilter ?? "",
        type: typeFilter ?? "",
        minAmount: minAmount ?? "",
        maxAmount: maxAmount ?? "",
        sort: sortParam ?? "recent",
    };

    let recurringRules: RecurringRule[] = [];
    let currencyCode = "USD";

    if (loadRecurring) {
        const recurringStart = PERF_ENABLED ? getTimeMs() : undefined;

        const { data: settings } = await supabase.from("user_settings").select("currency_code").eq("user_id", user.id).maybeSingle();
        currencyCode = settings?.currency_code ?? "USD";

        const reminders = await processRecurringSchedules(supabase, user.id, currencyCode, user.email ?? undefined);
        const { data: rows, error: recurringError } = await supabase
            .from("recurring_transactions")
            .select("id, name, amount, type, payment_method, notes, auto_log, frequency, next_run_on, categories (id, name), accounts (id, name)")
            .eq("user_id", user.id)
            .is("deleted_at", null)
            .order("name", { ascending: true });
        if (recurringError) {
            throw recurringError;
        }
        const dueIds = new Set((reminders ?? []).map((rule) => rule.id));

        recurringRules =
            rows?.map((row) => ({
                id: row.id,
                name: row.name,
                amount: Number(row.amount ?? 0),
                type: row.type as "income" | "expense",
                paymentMethod: row.payment_method,
                notes: row.notes ?? null,
                autoLog: row.auto_log ?? true,
                frequency: row.frequency as "daily" | "weekly" | "monthly" | "yearly",
                nextRunOn: row.next_run_on,
                categoryName: row.categories?.name ?? null,
                accountName: row.accounts?.name ?? null,
                isDue: dueIds.has(row.id) || (!row.auto_log && row.next_run_on <= new Date().toISOString().slice(0, 10)),
            })) ?? [];

        perfLog("recurring fetch + process", recurringStart);
    }

    perfLog("page total", pageStart);

    return (
        <div className="min-h-screen bg-slate-50">
            <MobileNav />

            <main className="page-shell mx-auto flex w-full max-w-2xl flex-col gap-6 py-6">
                <Suspense fallback={<FormSkeleton />}>
                    <FormSection userId={user.id} />
                </Suspense>

                {loadRecurring ? (
                    <section className="-mx-5">
                        <RecurringTransactionsPanel rules={recurringRules} currencyCode={currencyCode} />
                    </section>
                ) : (
                    <section className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-700 -mx-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-semibold text-slate-900">Recurring schedules</p>
                                <p className="text-xs text-slate-500">Load only when needed to speed up this page.</p>
                            </div>
                            <Link
                                href={`/transactions?recurring=1`}
                                className="whitespace-nowrap rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-indigo-600 hover:border-indigo-300 hover:text-indigo-500"
                            >
                                Load recurring
                            </Link>
                        </div>
                    </section>
                )}

                <Suspense key={sectionKey} fallback={<ListSkeleton />}>
                    <TransactionsSection
                        userId={user.id}
                        page={page}
                        pageSize={DEFAULT_TRANSACTIONS_PAGE_SIZE}
                        filters={transactionFiltersForList}
                        sharedInitialFilters={sharedInitialFilters}
                    />
                </Suspense>
            </main>
        </div>
    );
}

function FormSkeleton() {
    return <div className="h-72 animate-pulse rounded-3xl border border-slate-200 bg-white" />;
}

function ListSkeleton() {
    return (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 h-4 w-40 animate-pulse rounded bg-slate-200" />
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, idx) => (
                    <div key={idx} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ))}
            </div>
        </div>
    );
}
