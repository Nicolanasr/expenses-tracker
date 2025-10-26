'use client';

type DashboardSummaryCardsProps = {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  transactionCount: number;
  currencyCode: string;
};

export function DashboardSummaryCards({
  totalIncome,
  totalExpenses,
  balance,
  transactionCount,
  currencyCode,
}: DashboardSummaryCardsProps) {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  });
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Total income
        </p>
        <p className="mt-3 text-2xl font-semibold text-slate-900">
          {formatter.format(totalIncome)}
        </p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Total expenses
        </p>
        <p className="mt-3 text-2xl font-semibold text-slate-900">
          {formatter.format(totalExpenses)}
        </p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Remaining balance
        </p>
        <p
          className={`mt-3 text-2xl font-semibold ${
            balance >= 0 ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          {formatter.format(balance)}
        </p>
      </article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Transactions
        </p>
        <p className="mt-3 text-2xl font-semibold text-slate-900">
          {transactionCount}
        </p>
      </article>
    </section>
  );
}
