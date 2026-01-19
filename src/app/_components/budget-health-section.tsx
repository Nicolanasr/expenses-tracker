import { getTopBudgetUsage } from "@/lib/budgets";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { insertNotification } from "@/lib/notifications";

const DEFAULT_THRESHOLD_LEVELS = [50, 75, 90];

function formatMonthLabel(date: Date) {
	return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

type CategoryLite = { id: string; name: string };

type Props = {
	userId: string;
	userEmail?: string | null;
	cycleKey: string;
	cycleRangeStart: Date;
	categories: CategoryLite[];
	thresholdsByCategory?: Record<string, number[]>;
	notify?: boolean;
	currencyCode?: string;
	accountId?: string;
};

export async function BudgetHealthSection({
	userId,
	userEmail,
	cycleKey,
	cycleRangeStart,
	categories,
	thresholdsByCategory,
	notify = true,
	currencyCode,
	accountId,
}: Props) {
	const supabase = await createSupabaseServerComponentClient();
	const budgetUsage = await getTopBudgetUsage(cycleKey, 50, currencyCode, accountId);
	const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
	const budgetCycleLabel = formatMonthLabel(cycleRangeStart);

	const getThresholds = (categoryId: string | null | undefined) => {
		const custom = categoryId ? thresholdsByCategory?.[categoryId] : undefined;
		const arr = (custom ?? DEFAULT_THRESHOLD_LEVELS).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0 && n <= 100);
		const unique = Array.from(new Set(arr.map((n) => Math.round(n)))).sort((a, b) => a - b);
		return unique.length ? unique : DEFAULT_THRESHOLD_LEVELS;
	};

	if (notify && userId) {
		let triggeredBudgetKeys = new Set<string>();
		const { data: existingBudgetNotifications } = await supabase
			.from("notifications")
			.select("metadata")
			.eq("user_id", userId)
			.eq("type", "budget_threshold")
			.eq("metadata->>month", cycleKey);

		triggeredBudgetKeys = new Set(
			(existingBudgetNotifications ?? [])
				.map((notification) => {
					const metadata = notification.metadata as { categoryId?: string; level?: number; month?: string } | null;
					if (!metadata?.categoryId || typeof metadata.level !== "number" || !metadata.month) {
						return null;
					}
					return `${metadata.categoryId}:${metadata.level}:${metadata.month}`;
				})
				.filter((value): value is string => Boolean(value)),
		);

		for (const budget of budgetUsage) {
			const categoryId = budget.category_id;
			if (!categoryId) continue;
			const pct = Math.round(budget.used_pct ?? 0);
			const categoryName = categoryNameById.get(categoryId) ?? "This category";
			const levels = getThresholds(categoryId);
			const eligible = levels.filter((value) => {
				const key = `${categoryId}:${value}:${cycleKey}`;
				return pct >= value && !triggeredBudgetKeys.has(key);
			});
			const highest = eligible.length ? Math.max(...eligible) : null;
			if (highest !== null) {
				const key = `${categoryId}:${highest}:${cycleKey}`;
				await insertNotification(supabase, userId, {
					title: `${categoryName} budget ${highest}% reached`,
					body: `${categoryName} has used ${pct}% of its ${budgetCycleLabel} budget.`,
					sendEmail: true,
					userEmail: userEmail ?? undefined,
					type: "budget_threshold",
					metadata: { categoryId, level: highest, month: cycleKey },
				});
				triggeredBudgetKeys.add(key);
			}
		}
	}

	const topBudgetDisplay = budgetUsage.slice(0, 3);
	const remainingBudgets = budgetUsage.slice(3);

	if (!budgetUsage.length) {
		return null;
	}

	const renderRow = (row: (typeof budgetUsage)[number]) => {
		const pct = Math.round(row.used_pct ?? 0);
		const pctLabel = `${pct}%`;
		const barColor = pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
		return (
			<div key={row.category_id} className="space-y-1 rounded-xl border border-slate-100 p-3">
				<div className="flex items-center justify-between text-sm font-semibold text-slate-900">
					<span>{categoryNameById.get(row.category_id ?? "") ?? "Category"}</span>
					<span className="text-xs text-slate-500">{pctLabel}</span>
				</div>
				<div className="h-2 w-full rounded-full bg-slate-100">
					<div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
				</div>
				<div className="flex justify-between text-xs text-slate-500">
					<span>Budget {(row.budget_cents / 100).toFixed(2)}</span>
					<span>Spent {(row.spent_cents / 100).toFixed(2)}</span>
				</div>
			</div>
		);
	};

	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<h2 className="text-base font-semibold text-slate-900">Budget health</h2>
			<p className="text-xs text-slate-500">Top categories by % used this cycle.</p>
			<div className="mt-3 space-y-2">{topBudgetDisplay.map(renderRow)}</div>
			{remainingBudgets.length ? (
				<details className="mt-3">
					<summary className="cursor-pointer text-xs font-semibold text-indigo-600">Show all budget insights</summary>
					<div className="mt-2 space-y-2">{remainingBudgets.map(renderRow)}</div>
				</details>
			) : null}
		</section>
	);
}

export function BudgetHealthFallback() {
	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
			<div className="mt-2 h-3 w-48 animate-pulse rounded bg-slate-100" />
			<div className="mt-4 space-y-2">
				{Array.from({ length: 3 }).map((_, idx) => (
					<div key={idx} className="space-y-1 rounded-xl border border-slate-100 p-3">
						<div className="flex items-center justify-between">
							<div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
							<div className="h-3 w-8 animate-pulse rounded bg-slate-200" />
						</div>
						<div className="h-2 w-full animate-pulse rounded-full bg-slate-100" />
					</div>
				))}
			</div>
		</section>
	);
}
