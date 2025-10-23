'use client';

import { useTransition } from 'react';

import { signOut } from '@/app/auth/actions';

export function SignOutButton() {
    const [pending, startTransition] = useTransition();

    return (
        <button
            type="button"
            onClick={() => startTransition(() => signOut())}
            disabled={pending}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-1 h-fit text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
            {pending ? 'Signing out…' : 'Sign out'}
        </button>
    );
}
