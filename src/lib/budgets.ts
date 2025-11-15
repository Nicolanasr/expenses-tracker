import { toCents } from "@/lib/money";
import { getCycleRange } from "@/lib/pay-cycle";
import { createSupabaseServerActionClient, createSupabaseServerComponentClient } from "@/lib/supabase/server";

export type BudgetRow = {
	category_id: string;
	budget_cents: number;
	spent_cents: number;
	remaining_cents: number;
	used_pct: number;
};

export async function getBudgetSummary(month: string) {
	const supabase = await createSupabaseServerComponentClient();
	const { data, error } = await supabase.rpc("rpc_get_budget_summary", { p_month: month });

	if (error) {
		throw error;
	}

	return (data ?? []) as BudgetRow[];
}

export async function upsertBudget(input: { categoryId: string; month: string; amountCents: number }) {
	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		throw userError ?? new Error("User not found");
	}

	const { data, error } = await supabase
		.from("budgets")
		.upsert(
			{
				user_id: user.id,
				category_id: input.categoryId,
				month: input.month,
				amount_cents: input.amountCents,
			},
			{ onConflict: "user_id,category_id,month" }
		)
		.select()
		.single();

	if (error) {
		throw error;
	}

	return data;
}

export async function copyBudgets(fromMonth: string, toMonth: string) {
	const supabase = await createSupabaseServerActionClient();
	const { data, error } = await supabase.rpc("rpc_copy_budgets", {
		p_from_month: fromMonth,
		p_to_month: toMonth,
	});

	if (error) {
		throw error;
	}

	return (data ?? 0) as number;
}

export async function getTopBudgetUsage(month: string, limit = 5) {
	const rows = await getBudgetSummary(month);
	return rows
		.slice()
		.sort((a, b) => (b.used_pct ?? 0) - (a.used_pct ?? 0))
		.slice(0, limit);
}

export { toCents, fromCents } from "@/lib/money";

export async function getCategorySpendMap(month: string, payCycleStartDay: number) {
	const supabase = await createSupabaseServerComponentClient();
	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		throw userError ?? new Error("User not found");
	}

	const { startISO, endISOExclusive } = getCycleRange(month, payCycleStartDay);
	const { data, error } = await supabase
		.from("transactions")
		.select("category_id, amount")
		.eq("type", "expense")
		.eq("user_id", user.id)
		.gte("occurred_on", startISO)
		.lt("occurred_on", endISOExclusive);

	if (error) {
		throw error;
	}

	const map: Record<string, number> = {};
	for (const row of data ?? []) {
		const id = row.category_id;
		if (!id) {
			continue;
		}
		const cents = toCents(Number(row.amount ?? 0));
		map[id] = (map[id] ?? 0) + cents;
	}
	return map;
}
