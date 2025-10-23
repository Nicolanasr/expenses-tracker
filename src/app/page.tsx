import Link from 'next/link';
import { redirect } from 'next/navigation';

import { MobileNav } from '@/app/_components/mobile-nav';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Transaction = {
  id: string;
  amount: number;
  occurred_on: string;
  type: 'income' | 'expense';
  notes: string | null;
  categories: {
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
};

const CURRENCY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

function startOfMonthISO(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function endOfMonthISO(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
}

export default async function OverviewPage() {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }
  const today = new Date();

  const [{ data: monthTransactions }, { data: latestTransactions }] =
    await Promise.all([
      supabase
        .from('transactions')
        .select('amount, type')
        .gte('occurred_on', startOfMonthISO(today))
        .lte('occurred_on', endOfMonthISO(today)),
      supabase
        .from('transactions')
        .select(
          `
          id,
          amount,
          occurred_on,
          type,
          notes,
          categories (
            name,
            icon,
            color
          )
        `,
        )
        .order('occurred_on', { ascending: false })
        .limit(5),
    ]);

  const incomeTotal =
    monthTransactions
      ?.filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0) ?? 0;

  const expenseTotal =
    monthTransactions
      ?.filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0) ?? 0;

  const net = incomeTotal - expenseTotal;

  const transactions: Transaction[] = latestTransactions ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <MobileNav />

      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-6">
        <section className="grid grid-cols-1 gap-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Income this month
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {CURRENCY.format(incomeTotal)}
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Spend this month
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {CURRENCY.format(expenseTotal)}
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Net balance
            </p>
            <p
              className={`mt-3 text-3xl font-semibold ${
                net >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {CURRENCY.format(net)}
            </p>
          </article>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Latest activity
            </h2>
            <Link
              href="/transactions"
              className="text-sm font-semibold text-indigo-600"
            >
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
                No transactions yet. Add your first one to see it here.
              </p>
            ) : (
              transactions.map((transaction) => (
                <article
                  key={transaction.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-lg"
                      style={{
                        color:
                          transaction.categories?.color ?? '#4f46e5',
                        borderColor:
                          transaction.categories?.color ?? '#c7d2fe',
                      }}
                      aria-hidden
                    >
                      {transaction.categories?.icon ?? '🏷️'}
                    </span>
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-slate-900">
                        {transaction.categories?.name ?? 'Uncategorised'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {DATE.format(new Date(transaction.occurred_on))}
                      </p>
                      {transaction.notes ? (
                        <p className="mt-1 text-xs text-slate-600">
                          {transaction.notes}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      transaction.type === 'income'
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    {CURRENCY.format(Number(transaction.amount))}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            Quick actions
          </h2>
          <div className="grid grid-cols-1 gap-3">
            <Link
              href="/transactions"
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm"
            >
              Add a transaction
              <span className="text-indigo-500">→</span>
            </Link>
            <Link
              href="/categories"
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm"
            >
              Manage categories
              <span className="text-indigo-500">→</span>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
