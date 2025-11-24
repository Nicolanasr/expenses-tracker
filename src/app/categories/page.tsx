import { redirect } from 'next/navigation';

import { CreateCategoryForm } from '@/app/_components/create-category-form';
import { MobileNav } from '@/app/_components/mobile-nav';
import { CategoryRow } from '@/app/categories/_components/category-row';
import { OfflineFallback } from '@/app/_components/offline-fallback';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Category = {
    id: string;
    name: string;
    type: 'income' | 'expense';
    icon: string | null;
    color: string | null;
    updated_at: string;
    created_at: string;
};

export default async function CategoriesPage() {
    const supabase = await createSupabaseServerComponentClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/sign-in');
    }

    if (userError?.name == "AuthRetryableFetchError") {
        return <OfflineFallback />;
    }

    if (userError) {
        return <OfflineFallback />;
    }
    const { data } = await supabase
        .from('categories')
        .select('id, name, type, icon, color, created_at, updated_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    const categories: Category[] = data ?? [];

    return (
        <div className="min-h-screen bg-slate-50">
            <MobileNav />

            <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-6">
                <section>
                    <CreateCategoryForm />
                </section>

                <section className="space-y-4">
                    <h2 className="text-base font-semibold text-slate-900">
                        Your categories
                    </h2>
                    {categories.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
                            No categories yet. Add a few above to organize your spending.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {categories.map((category) => (
                                <CategoryRow key={category.id} category={category} />
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
