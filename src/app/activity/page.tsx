import { MobileNav } from '@/app/_components/mobile-nav';
import { OfflineFallback } from '@/app/_components/offline-fallback';
import { createSupabaseServerComponentClient, type Json } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type AuditRow = {
    id: string;
    table_name: string;
    record_id: string;
    action: string;
    created_at: string;
    snapshot: Json | null;
};

function formatDate(value: string) {
    return new Date(value).toLocaleString('en-US');
}

export default async function ActivityPage() {
    const supabase = await createSupabaseServerComponentClient();
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error?.name === 'AuthRetryableFetchError') {
        return <OfflineFallback />;
    }

    if (!user) {
        return <OfflineFallback />;
    }

    const { data: rows, error: auditError } = await supabase
        .from('audit_log')
        .select('id, table_name, record_id, action, created_at, snapshot')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

    if (auditError) {
        console.error(auditError);
        return <OfflineFallback />;
    }

    const items: AuditRow[] = (rows ?? []) as AuditRow[];

    return (
        <div className="min-h-screen bg-slate-50">
            <MobileNav />
            <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-6">
                <header className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Activity</p>
                        <h1 className="text-xl font-semibold text-slate-900">Recent changes</h1>
                        <p className="text-sm text-slate-600">Last 50 creates, updates, deletes, restores across your data.</p>
                    </div>
                </header>

                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {items.length === 0 ? (
                        <p className="p-4 text-sm text-slate-600">No activity recorded yet.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {items.map((item) => (
                                <li key={item.id} className="grid gap-1 px-4 py-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs font-semibold capitalize text-slate-700">
                                                {item.action}
                                            </span>
                                            <span className="text-slate-800">{item.table_name}</span>
                                            <span className="text-xs text-slate-500">#{item.record_id.slice(0, 8)}</span>
                                        </div>
                                        <span className="text-xs text-slate-400">{formatDate(item.created_at)}</span>
                                    </div>
                                    {item.snapshot ? (
                                        <pre className="overflow-auto rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                                            {JSON.stringify(item.snapshot, null, 2)}
                                        </pre>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </main>
        </div>
    );
}
