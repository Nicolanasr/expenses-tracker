'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import {
  type AuthFormState,
  signIn,
} from '@/app/auth/actions';

export function SignInForm() {
  const initialState: AuthFormState = { ok: false, errors: {} };
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    signIn,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-semibold text-slate-800">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-100"
        />
        {state.errors?.email?.length ? (
          <p className="text-xs text-rose-500">{state.errors.email[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="password"
          className="text-sm font-semibold text-slate-800"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-100"
        />
        {state.errors?.password?.length ? (
          <p className="text-xs text-rose-500">{state.errors.password[0]}</p>
        ) : null}
      </div>

      {state.message ? (
        <p className="text-sm font-medium text-rose-500">{state.message}</p>
      ) : null}

      <button
        type="submit"
        className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700"
      >
        Sign in
      </button>

      <p className="text-xs text-slate-600">
        Need an account?{' '}
        <Link href="/auth/sign-up" className="font-semibold text-indigo-600">
          Create one
        </Link>
      </p>
    </form>
  );
}
