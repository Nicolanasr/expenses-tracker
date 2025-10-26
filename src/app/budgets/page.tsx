import { redirect } from "next/navigation";

import { MobileNav } from "@/app/_components/mobile-nav";
import BudgetTable from "@/app/budgets/table";
import { getBudgetSummary, getCategorySpendMap } from "@/lib/budgets";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { currentCycleKeyForDate, getCycleRange, shiftMonth } from "@/lib/pay-cycle";

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function BudgetsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
	const supabase = await createSupabaseServerComponentClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/auth/sign-in");
	}

	const { data: settingsData } = await supabase
		.from("user_settings")
		.select("currency_code, pay_cycle_start_day")
		.eq("user_id", user.id)
		.maybeSingle();

	const payCycleStartDay = settingsData?.pay_cycle_start_day ?? 1;
	const currencyCode = settingsData?.currency_code ?? "USD";
	const resolvedSearchParams = searchParams ? await searchParams : {};
	const monthParam = resolvedSearchParams?.month;
	const requestedMonth = Array.isArray(monthParam) ? monthParam[0] : monthParam;
	const defaultCycleKey = currentCycleKeyForDate(new Date(), payCycleStartDay);
	const month = requestedMonth && MONTH_REGEX.test(requestedMonth) ? requestedMonth : defaultCycleKey;

	const [{ data: categoryRows }, summary, categorySpend] = await Promise.all([
		supabase
			.from("categories")
			.select("id, name")
			.eq("user_id", user.id)
			.eq("type", "expense")
			.order("name", { ascending: true }),
		getBudgetSummary(month),
		getCategorySpendMap(month, payCycleStartDay),
	]);

	const categories = categoryRows ?? [];
	const cycleRange = getCycleRange(month, payCycleStartDay);
	const prevMonth = shiftMonth(month, -1);
	const canCopy = summary.length === 0 && month === defaultCycleKey;
	const rangeFormatter = new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
	const cycleLabel = `${rangeFormatter.format(cycleRange.startDate)} – ${rangeFormatter.format(cycleRange.endDateInclusive)}`;

	return (
		<div className="min-h-screen bg-slate-50">
			<MobileNav />
			<main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-6">
				<section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
					<div>
						<p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Plan ahead</p>
						<h1 className="text-2xl font-semibold text-slate-900">Budgets</h1>
						<p className="text-sm text-slate-500">Current cycle: {cycleLabel}</p>
					</div>

					<form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
						<label className="flex flex-col text-sm font-semibold text-slate-700">
							<span className="mb-1 text-xs uppercase tracking-wide text-slate-400">Cycle month</span>
							<input
								type="month"
								name="month"
								defaultValue={month}
								className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
							/>
						</label>
						<button
							type="submit"
							className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
						>
							Update
						</button>
					</form>
				</section>

				<section>
					<BudgetTable
						month={month}
						prevMonth={prevMonth}
						categories={categories}
						summary={summary}
						categorySpend={categorySpend ?? {}}
						currencyCode={currencyCode}
						cycleLabel={cycleLabel}
						canCopy={canCopy}
					/>
				</section>
			</main>
		</div>
	);
}
