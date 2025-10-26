import { redirect } from 'next/navigation';

import { MobileNav } from '@/app/_components/mobile-nav';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <MobileNav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-6">
        <section className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
          <p className="text-sm text-slate-500">
            This area is reserved for richer profile details (avatar, email,
            security). Customize it as your product evolves.
          </p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          <p>
            Signed in as <span className="font-semibold">{user.email}</span>.
          </p>
          <p className="mt-2">
            Add more profile fields here (bio, contact info, etc.) depending on
            your future requirements.
          </p>
        </section>
      </main>
    </div>
  );
}
