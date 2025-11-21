'use client';

type AccountSummary = {
    id: string;
    name: string;
    type: string;
    balance: number;
    currencyCode: string;
    institution?: string | null;
};

const TYPE_LABELS: Record<string, string> = {
    cash: 'Cash',
    checking: 'Checking',
    savings: 'Savings',
    credit: 'Credit',
    investment: 'Investment',
    other: 'Other',
};

export function AccountBalanceCards({ accounts }: { accounts: AccountSummary[] }) {
    if (!accounts.length) return null;
    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accounts</p>
                    <p className="text-sm text-slate-500">Latest balance per account</p>
                </div>
            </div>
            <div className="mt-4 gap-3 flex flex-wrap">
                {accounts.map((account) => {
                    const formatter = new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: account.currencyCode,
                    });
                    return (
                        <article key={account.id} className="flex-1 min-w-52 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-inner">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-base font-semibold text-slate-900">{account.name}</p>
                                    <p className="text-xs uppercase tracking-wide text-slate-500">
                                        {TYPE_LABELS[account.type] ?? account.type}
                                        {account.institution ? ` · ${account.institution}` : ''}
                                    </p>
                                </div>
                                <p className={`text-sm font-semibold ${account.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {formatter.format(account.balance)}
                                </p>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
