import { redirect } from 'next/navigation';

import { MobileNav } from '@/app/_components/mobile-nav';
import { AccountSettingsForm } from '@/app/account/_components/account-settings-form';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
    const supabase = await createSupabaseServerComponentClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/sign-in');
    }

    const { data: settings } = await supabase
        .from('user_settings')
        .select('currency_code, display_name, pay_cycle_start_day')
        .eq('user_id', user.id)
        .maybeSingle();

    const { count: transactionsCount, error: transactionsError } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

    if (transactionsError) {
        throw transactionsError;
    }

    const currencyCode = settings?.currency_code ?? 'USD';
    const displayName = settings?.display_name ?? null;
    const payCycleStartDay = settings?.pay_cycle_start_day ?? 1;
    const hasTransactions = (transactionsCount ?? 0) > 0;

    return (
        <div className="min-h-screen bg-slate-50">
            <MobileNav />
            <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-6">
                <section className="space-y-2">
                    <h1 className="text-2xl font-semibold text-slate-900">
                        Account settings
                    </h1>
                    <p className="text-sm text-slate-500">
                        Update your preferred currency and profile details. Existing
                        transactions keep their original currency.
                    </p>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <AccountSettingsForm
                        currencyCode={currencyCode}
                        displayName={displayName}
                        payCycleStartDay={payCycleStartDay}
                        isCurrencyLocked={hasTransactions}
                    />
                </section>
            </main>
        </div>
    );
}
