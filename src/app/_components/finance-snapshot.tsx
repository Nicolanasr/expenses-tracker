"use server";

import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

type FinanceSnapshotProps = {
  userId: string;
  currencyCode: string;
  currentStart: string;
  currentEnd: string;
  prevStart: string;
  prevEnd: string;
};

type AggRow = {
  type: "income" | "expense";
  amount: number;
};

type CategoryAgg = {
  category_id: string | null;
  categories: { name: string | null } | null;
  amount: number;
};

type DailyAgg = {
  occurred_on: string;
  type: "income" | "expense";
  amount: number;
};

function fmtCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(value);
}

function pctDelta(current: number, prev: number) {
  if (!prev) return current === 0 ? 0 : 100;
  return ((current - prev) / prev) * 100;
}

export async function FinanceSnapshot({ userId, currencyCode, currentStart, currentEnd, prevStart, prevEnd }: FinanceSnapshotProps) {
  const supabase = await createSupabaseServerComponentClient();

  const [currentRes, prevRes, currentDaily, currentCategories] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, amount")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .neq("payment_method", "account_transfer")
      .gte("occurred_on", currentStart)
      .lte("occurred_on", currentEnd),
    supabase
      .from("transactions")
      .select("type, amount")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .neq("payment_method", "account_transfer")
      .gte("occurred_on", prevStart)
      .lte("occurred_on", prevEnd),
    supabase
      .from("transactions")
      .select("occurred_on, type, amount")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .neq("payment_method", "account_transfer")
      .gte("occurred_on", currentStart)
      .lte("occurred_on", currentEnd),
    supabase
      .from("transactions")
      .select("category_id, amount, categories(name)")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .neq("payment_method", "account_transfer")
      .gte("occurred_on", currentStart)
      .lte("occurred_on", currentEnd),
  ]);

  const sumByType = (rows: AggRow[]) => rows.reduce(
    (acc, row) => {
      if (row.type === "income") acc.income += Number(row.amount ?? 0);
      else acc.expense += Number(row.amount ?? 0);
      return acc;
    },
    { income: 0, expense: 0 },
  );

  const currentSums = sumByType((currentRes.data ?? []) as AggRow[]);
  const prevSums = sumByType((prevRes.data ?? []) as AggRow[]);

  const dailyMap = new Map<string, { income: number; expense: number }>();
  ((currentDaily.data ?? []) as DailyAgg[]).forEach((row) => {
    const day = row.occurred_on;
    const entry = dailyMap.get(day) ?? { income: 0, expense: 0 };
    if (row.type === "income") entry.income += Number(row.amount ?? 0);
    else entry.expense += Number(row.amount ?? 0);
    dailyMap.set(day, entry);
  });
  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([date, val]) => ({ date, ...val }));

  const daysElapsed = daily.length || 1;
  const avgDailySpend = currentSums.expense / daysElapsed;
  const avgDailyIncome = currentSums.income / daysElapsed;
  // Simple burn projection: current spend rate * 30 days (approx)
  const projectedExpense = avgDailySpend * 30;
  const projectedIncome = avgDailyIncome * 30;
  const projectedNet = projectedIncome - projectedExpense;

  const categoryTotals = new Map<string, number>();
  ((currentCategories.data ?? []) as CategoryAgg[]).forEach((row) => {
    const key = row.category_id ?? "uncategorised";
    categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + Number(row.amount ?? 0));
  });
  const topCategories = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Finance snapshot</p>
          <h2 className="text-lg font-semibold text-slate-900">Trends & projection</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right text-xs font-semibold text-slate-700 sm:text-sm">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">MoM income</p>
            <p className="text-sm font-bold text-emerald-600">{fmtCurrency(currentSums.income, currencyCode)}</p>
            <p className="text-[11px] font-semibold text-emerald-700">{pctDelta(currentSums.income, prevSums.income).toFixed(1)}%</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">MoM expense</p>
            <p className="text-sm font-bold text-rose-600">{fmtCurrency(currentSums.expense, currencyCode)}</p>
            <p className="text-[11px] font-semibold text-rose-700">{pctDelta(currentSums.expense, prevSums.expense).toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average daily spend</p>
          <p className="text-lg font-bold text-slate-900">{fmtCurrency(avgDailySpend, currencyCode)}</p>
          <p className="text-[11px] text-slate-600">Vs income pace: {fmtCurrency(avgDailyIncome, currencyCode)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Projected net (30d)</p>
          <p className={`text-lg font-bold ${projectedNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtCurrency(projectedNet, currencyCode)}</p>
          <p className="text-[11px] text-slate-600">Income {fmtCurrency(projectedIncome, currencyCode)} · Expense {fmtCurrency(projectedExpense, currencyCode)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top spend categories</p>
          <div className="mt-2 space-y-1 text-[11px] font-semibold text-slate-700">
            {topCategories.length === 0 ? <p className="text-slate-500">No data yet.</p> : null}
            {topCategories.map(([id, amt]) => {
              const match = (currentCategories.data ?? []).find((row) => row.category_id === id) as CategoryAgg | undefined;
              const name = id === 'uncategorised' ? 'Uncategorised' : match?.categories?.name ?? 'Category';
              return (
                <div key={id} className="flex items-center justify-between">
                  <span>{name}</span>
                  <span>{fmtCurrency(amt, currencyCode)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">50/30/20 rule</p>
          <p className="text-[11px] text-slate-600">50% needs, 30% wants, 20% saving/debt. Reallocate if spends drift.</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zero-based budgeting</p>
          <p className="text-[11px] text-slate-600">Assign every $ before the month starts; leave $0 unplanned.</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pay-yourself-first</p>
          <p className="text-[11px] text-slate-600">Auto-move savings/investing at payday, then spend the rest.</p>
        </div>
      </div>
    </section>
  );
}
