import { redirect } from 'next/navigation';

import { CreateTransactionForm } from '@/app/_components/create-transaction-form';
import { MobileNav } from '@/app/_components/mobile-nav';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Category = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string | null;
  color: string | null;
};

type Transaction = {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  occurred_on: string;
  payment_method: 'cash' | 'card' | 'transfer' | 'other';
  notes: string | null;
  categories: Category | null;
};

const CURRENCY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const DATE = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
});

export default async function TransactionsPage() {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const [{ data: categories }, { data: transactions }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, type, icon, color')
      .order('name', { ascending: true }),
    supabase
      .from('transactions')
      .select(
        `
        id,
        amount,
        type,
        occurred_on,
        payment_method,
        notes,
        categories (
          id,
          name,
          type,
          icon,
          color
        )
      `,
      )
      .order('occurred_on', { ascending: false }),
  ]);

  const transactionsByDate = (transactions ?? []).reduce<
    Record<string, Transaction[]>
  >((acc, transaction) => {
    const dateKey = transaction.occurred_on;
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(transaction);
    return acc;
  }, {});

  const grouped = Object.entries(transactionsByDate).sort(
    ([dateA], [dateB]) =>
      new Date(dateB).getTime() - new Date(dateA).getTime(),
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <MobileNav />

      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-6">
        <section>
          <CreateTransactionForm categories={categories ?? []} />
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900">
            All transactions
          </h2>

          {grouped.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
              Nothing here yet. Add a transaction above to start tracking.
            </p>
          ) : (
            <div className="space-y-4">
              {grouped.map(([date, dayTransactions]) => (
                <div key={date} className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {DATE.format(new Date(date))}
                  </h3>
                  <div className="space-y-3">
                    {dayTransactions.map((transaction) => (
                      <article
                        key={transaction.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
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
                                {transaction.categories?.name ??
                                  'Uncategorised'}
                              </p>
                              <p className="text-xs font-medium uppercase text-slate-500">
                                {transaction.payment_method}
                              </p>
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
                        </div>
                        {transaction.notes ? (
                          <p className="mt-3 text-xs text-slate-600">
                            {transaction.notes}
                          </p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
