import { redirect } from 'next/navigation';

import { MobileNav } from '@/app/_components/mobile-nav';
import { OfflineFallback } from '@/app/_components/offline-fallback';
import { TransferForm } from '@/app/transfers/_components/transfer-form';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function matchesKeyword(value: string | null, keyword: string) {
    if (!value) return false;
    return value.toLowerCase().includes(keyword);
}

function pickQuickActions(accounts: Array<{ id: string; name: string; type: string }>) {
    const main = accounts.find((account) => matchesKeyword(account.name, 'main')) ?? accounts[0];
    const savings = accounts.find((account) => account.type === 'savings' || matchesKeyword(account.name, 'sav'));
    const cash = accounts.find((account) => account.type === 'cash' || matchesKeyword(account.name, 'cash'));

    const actions: Array<{ label: string; fromId: string; toId: string }> = [];
    if (main && savings) {
        actions.push({ label: `Move to ${savings.name}`, fromId: main.id, toId: savings.id });
    }
    if (main && cash) {
        actions.push({ label: 'Cash withdrawal', fromId: main.id, toId: cash.id });
    }
    return actions;
}

export default async function TransfersPage() {
    const supabase = await createSupabaseServerComponentClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError?.name === 'AuthRetryableFetchError') {
        return <OfflineFallback />;
    }

    if (!user) {
        redirect('/auth/sign-in');
    }

    const [{ data: accountRows, error: accountsError }, { data: txRows, error: txError }] = await Promise.all([
        supabase
            .from('accounts')
            .select('id, name, type, institution, starting_balance')
            .eq('user_id', user.id)
            .order('name', { ascending: true }),
        supabase
            .from('transactions')
            .select('account_id, type, amount')
            .eq('user_id', user.id)
            .not('account_id', 'is', null),
    ]);

    if (accountsError || txError) {
        console.error(accountsError || txError);
        return <OfflineFallback />;
    }

    const accounts = (accountRows ?? []).map((account) => {
        const starting = Number(account.starting_balance ?? 0);
        const movements = (txRows ?? [])
            .filter((tx) => tx.account_id === account.id)
            .reduce((sum, tx) => {
                const amount = Number(tx.amount ?? 0);
                return tx.type === 'income' ? sum + amount : sum - amount;
            }, 0);
        return {
            id: account.id,
            name: account.name,
            type: account.type,
            balance: starting + movements,
        };
    });

    return (
        <div className="min-h-screen bg-slate-50">
            <MobileNav />
            <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-6">
                <TransferForm accounts={accounts} quickActions={pickQuickActions(accounts)} />
                <section className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
                    <h2 className="text-base font-semibold text-slate-900">How transfers work</h2>
                    <ul className="mt-3 list-disc space-y-1 pl-5">
                        <li>Create one transfer and Expenseo records the expense + income for you.</li>
                        <li>Quick actions help with common flows (Main → Savings, Main → Cash).</li>
                        <li>If a cash or savings account doesn’t exist yet, add it under Settings → Accounts.</li>
                    </ul>
                </section>
            </main>
        </div>
    );
}
