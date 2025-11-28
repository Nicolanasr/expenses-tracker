"use server";

import { DashboardSummaryCards } from "@/app/_components/dashboard-summary-cards";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

type Props = {
	userId: string;
	start: string;
	end: string;
	categoryIds?: string[];
	accountId?: string | null;
	paymentMethod?: string;
	search?: string;
};

export async function OverviewSummarySection({ userId, start, end, categoryIds, accountId, paymentMethod, search }: Props) {
	const supabase = await createSupabaseServerComponentClient();

	let query = supabase
		.from("transactions")
		.select("amount,type,payment_method,notes,categories(name)")
		.eq("user_id", userId)
		.is("deleted_at", null)
		.gte("occurred_on", start)
		.lte("occurred_on", end);

	if (categoryIds?.length) query = query.in("category_id", categoryIds);
	if (accountId) query = query.eq("account_id", accountId);
	if (paymentMethod) query = query.eq("payment_method", paymentMethod);
	if (search && search.trim()) {
		const term = `%${search.trim().replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
		query = query.or(`notes.ilike.${term},categories.name.ilike.${term}`);
	}

	const { data = [] } = await query;
	const reportTransactions = (data ?? []).filter((tx) => tx.payment_method !== "account_transfer");

	const totalIncome = reportTransactions.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0);
	const totalExpenses = reportTransactions.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0);

	return (
		<DashboardSummaryCards
			totalIncome={totalIncome}
			totalExpenses={totalExpenses}
			balance={totalIncome - totalExpenses}
			transactionCount={reportTransactions.length}
			currencyCode={"USD"}
		/>
	);
}
