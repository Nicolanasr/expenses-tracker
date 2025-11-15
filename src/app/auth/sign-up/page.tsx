import { redirect } from 'next/navigation';

import { SignUpForm } from '@/app/auth/sign-up/sign-up-form';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';

export const metadata = {
    title: 'Create account | Expenseo ',
};

export const dynamic = 'force-dynamic';

export default async function SignUpPage() {
    const supabase = await createSupabaseServerComponentClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (user) {
        redirect('/');
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
            <div className="w-full max-w-sm space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="space-y-2 text-center">
                    <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">
                        Expenseo
                    </p>
                    <h1 className="text-2xl font-semibold text-slate-900">
                        Create your account
                    </h1>
                    <p className="text-xs text-slate-500">
                        Sign up with an email and password to start tracking.
                    </p>
                </div>
                <SignUpForm />
            </div>
        </div>
    );
}
