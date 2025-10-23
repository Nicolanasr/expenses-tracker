import { redirect } from 'next/navigation';

import { CreateCategoryForm } from '@/app/_components/create-category-form';
import { MobileNav } from '@/app/_components/mobile-nav';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Category = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string | null;
  color: string | null;
  created_at: string;
};

const DATE = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
});

export default async function CategoriesPage() {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }
  const { data } = await supabase
    .from('categories')
    .select('id, name, type, icon, color, created_at')
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
                <article
                  key={category.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-lg"
                      style={{
                        color: category.color ?? '#4f46e5',
                        borderColor: category.color ?? '#c7d2fe',
                      }}
                      aria-hidden
                    >
                      {category.icon ?? '🏷️'}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {category.name}
                      </p>
                      <p className="text-xs font-medium uppercase text-slate-500">
                        {category.type}
                      </p>
                    </div>
                  </div>
                  <time className="text-xs text-slate-500">
                    Added {DATE.format(new Date(category.created_at))}
                  </time>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
