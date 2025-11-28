"use server";

import { TransactionsPaginatedList } from "@/app/_components/transactions-paginated-list";
import { TransactionsFilters } from "@/app/transactions/_components/transactions-filters";
import { TransactionsExportButton } from "@/app/transactions/_components/transactions-export-button";
import { fetchTransactionsPage, type TransactionQueryFilters } from "@/lib/transactions/pagination";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { normalizePaymentMethod } from "@/lib/payment-methods";

type Props = {
	userId: string;
	page: number;
	pageSize: number;
	filters: TransactionQueryFilters;
	title?: string;
	sharedInitialFilters: {
		start: string;
		end: string;
		categoryNames: string[];
		paymentMethod: string;
		search: string;
		accountId: string;
		type?: string;
		minAmount?: string;
		maxAmount?: string;
		sort?: string;
	};
};

export async function TransactionsSection({ userId, page, pageSize, filters, title = "All transactions", sharedInitialFilters }: Props) {
	const supabase = await createSupabaseServerComponentClient();
	const [{ data: categoryRows }, { data: accountRows }] = await Promise.all([
		supabase.from("categories").select("id, name, type, icon, color").eq("user_id", userId).is("deleted_at", null).order("name", { ascending: true }),
		supabase.from("accounts").select("id, name, type, institution, default_payment_method").eq("user_id", userId).is("deleted_at", null).order("name", { ascending: true }),
	]);

	const categories = (categoryRows ?? []).map((category) => ({
		id: category.id,
		name: category.name,
		icon: category.icon,
		color: category.color,
		type: category.type,
	}));

	const accounts = (accountRows ?? []).map((account) => ({
		id: account.id,
		name: account.name,
		type: account.type,
		institution: account.institution,
		defaultPaymentMethod: account.default_payment_method ?? null,
	}));

	const categoryIdSet = new Set(categories.map((c) => c.id));
	const categoryNameToId = new Map(categories.map((c) => [c.name, c.id]));
	const normalizedCategoryIds =
		filters.categoryIds?.map((idOrName) => {
			if (categoryIdSet.has(idOrName)) return idOrName;
			return categoryNameToId.get(idOrName) ?? null;
		}).filter((v): v is string => Boolean(v)) ?? undefined;

	const accountNameToId = new Map(accounts.map((a) => [a.name, a.id]));
	const resolvedAccountId = filters.accountId
		? accounts.some((a) => a.id === filters.accountId)
			? filters.accountId
			: accountNameToId.get(filters.accountId) ?? undefined
		: undefined;

	const normalizedFilters = {
		...filters,
		categoryIds: normalizedCategoryIds,
		accountId: resolvedAccountId,
	};

	const { rows, total } = await fetchTransactionsPage(supabase, userId, {
		page,
		pageSize,
		filters: normalizedFilters,
	});

	const normalized = rows.map((transaction) => ({
		id: transaction.id,
		amount: Number(transaction.amount ?? 0),
		type: transaction.type,
		currencyCode: transaction.currency_code ?? "USD",
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

	const payees = Array.from(new Set(rows.map((tx) => tx.payee).filter(Boolean))) as string[];

	const normalizedInitialFilters = {
		...sharedInitialFilters,
		type: sharedInitialFilters.type ?? "",
		minAmount: sharedInitialFilters.minAmount ?? "",
		maxAmount: sharedInitialFilters.maxAmount ?? "",
		sort: sharedInitialFilters.sort ?? "recent",
	};

	return (
		<TransactionsPaginatedList
			key={JSON.stringify(normalizedFilters)}
			initialTransactions={normalized}
			totalCount={total ?? 0}
			pageSize={pageSize}
			page={page}
			filters={normalizedFilters}
			categories={categories}
			accounts={accounts}
			payees={payees}
			allowEditing
			preferCacheOnMount={false}
			title={title}
			emptyMessage="Nothing here yet. Adjust the filters or add a transaction above."
			renderFilters={
				<details key="transactions-key">
					<summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">Filters</summary>
					<div className="mt-4">
						<TransactionsFilters key={JSON.stringify(normalizedInitialFilters)} categories={categories} accounts={accounts} initialFilters={normalizedInitialFilters} compact />
						<div className="mt-3 flex justify-end">
							<TransactionsExportButton filters={normalizedFilters} />
						</div>
					</div>
				</details>
			}
		/>
	);
}
