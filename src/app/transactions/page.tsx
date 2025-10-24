/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from 'next/navigation';

import { CreateTransactionForm } from '@/app/_components/create-transaction-form';
import { MobileNav } from '@/app/_components/mobile-nav';
import { TransactionItem } from '@/app/_components/transaction-item';
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
    category_id: string | null;
    categories: Category | null;
};

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
        category_id,
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
    >((acc, transaction: any) => {
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
                    <TransactionItem
                      key={transaction.id}
                      transaction={{
                        id: transaction.id,
                        amount: Number(transaction.amount ?? 0),
                        type: transaction.type,
                        occurredOn: transaction.occurred_on,
                        paymentMethod: transaction.payment_method,
                        notes: transaction.notes,
                        categoryId:
                          transaction.category_id ??
                          transaction.categories?.id ??
                          null,
                        category: transaction.categories
                          ? {
                              id: transaction.categories.id,
                              name: transaction.categories.name,
                              icon: transaction.categories.icon,
                              color: transaction.categories.color,
                              type: transaction.categories.type,
                            }
                          : null,
                      }}
                      categories={categories ?? []}
                      enableEditing
                    />
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
