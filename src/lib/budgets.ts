import { toCents } from "@/lib/money";
import { currentCycleKeyForDate, getCycleRange } from "@/lib/pay-cycle";
import { createSupabaseServerActionClient, createSupabaseServerComponentClient, type Database } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertNotification } from "@/lib/notifications";

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
				updated_at: new Date().toISOString(),
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
		.is("deleted_at", null)
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

function parseBudgetThresholds(value: unknown): Record<string, number[]> {
	if (!Array.isArray(value)) return {};
	const map = new Map<string, number[]>();
	value.forEach((entry) => {
		if (!entry || typeof entry !== "object") return;
		const record = entry as { categoryId?: unknown; levels?: unknown };
		if (typeof record.categoryId !== "string" || !Array.isArray(record.levels)) return;
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

function formatMonthLabel(date: Date) {
	return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

export async function processBudgetThresholds(
	client: SupabaseClient<Database>,
	userId: string,
	userEmail?: string | null,
) {
	// Grab settings for cycle and thresholds
	const { data: settings } = await client
		.from("user_settings")
		.select("pay_cycle_start_day, budget_thresholds")
		.eq("user_id", userId)
		.maybeSingle();

	const payCycleStartDay = settings?.pay_cycle_start_day ?? 1;
	const thresholdsMap = parseBudgetThresholds(settings?.budget_thresholds);
	const today = new Date();
	const cycleKey = currentCycleKeyForDate(today, payCycleStartDay);
	const cycleRange = getCycleRange(cycleKey, payCycleStartDay);

	// Fetch budgets usage + categories + existing notifications
	const [{ data: budgets }, { data: categories }, { data: existing }] = await Promise.all([
		client.rpc("rpc_get_budget_summary", { p_month: cycleKey }),
		client
			.from("categories")
			.select("id, name")
			.eq("user_id", userId)
			.is("deleted_at", null),
		client
			.from("notifications")
			.select("metadata")
			.eq("user_id", userId)
			.eq("type", "budget_threshold")
			.eq("metadata->>month", cycleKey),
	]);

	const categoryNameById = new Map((categories ?? []).map((c) => [c.id, c.name ?? "Category"]));
	const triggeredBudgetKeys = new Set(
		(existing ?? [])
			.map((notification) => {
				const metadata = notification.metadata as { categoryId?: string; level?: number; month?: string } | null;
				if (!metadata?.categoryId || typeof metadata.level !== "number" || !metadata.month) {
					return null;
				}
				return `${metadata.categoryId}:${metadata.level}:${metadata.month}`;
			})
			.filter((value): value is string => Boolean(value)),
	);

	const getThresholds = (categoryId: string | null | undefined) => {
		const custom = categoryId ? thresholdsMap[categoryId] : undefined;
		const arr = (custom ?? [50, 75, 90])
			.map((n) => Number(n))
			.filter((n) => Number.isFinite(n) && n > 0 && n <= 100);
		const unique = Array.from(new Set(arr.map((n) => Math.round(n)))).sort((a, b) => a - b);
		return unique.length ? unique : [50, 75, 90];
	};

	const budgetRows = (budgets ?? []) as { category_id: string | null; used_pct: number | null }[];
	for (const budget of budgetRows) {
		const categoryId = budget.category_id;
		if (!categoryId) continue;
		const pct = Math.round(budget.used_pct ?? 0);
		const levels = getThresholds(categoryId);
		const eligible = levels.filter((value) => {
			const key = `${categoryId}:${value}:${cycleKey}`;
			return pct >= value && !triggeredBudgetKeys.has(key);
		});
		const highest = eligible.length ? Math.max(...eligible) : null;
		if (highest !== null) {
			const key = `${categoryId}:${highest}:${cycleKey}`;
			await insertNotification(client, userId, {
				title: `${categoryNameById.get(categoryId) ?? "This category"} budget ${highest}% reached`,
				body: `${categoryNameById.get(categoryId) ?? "This category"} has used ${pct}% of its ${formatMonthLabel(
					cycleRange.startDate,
				)} budget.`,
				sendEmail: true,
				userEmail: userEmail ?? undefined,
				type: "budget_threshold",
				metadata: { categoryId, level: highest, month: cycleKey },
			});
			triggeredBudgetKeys.add(key);
		}
	}
}
