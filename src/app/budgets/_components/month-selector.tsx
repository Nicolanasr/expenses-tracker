'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import { shiftMonth } from '@/lib/pay-cycle';

export function MonthSelector({ month }: { month: string }) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [isPending, startTransition] = useTransition();

	const buildUrl = (nextMonth: string) => {
		const params = new URLSearchParams(searchParams?.toString());
		params.set('month', nextMonth);
		const query = params.toString();
		return query ? `/budgets?${query}` : '/budgets';
	};

	const navigate = (nextMonth: string) => {
		startTransition(() => {
			router.push(buildUrl(nextMonth));
		});
	};

	return (
		<div className="flex flex-wrap items-center gap-3">
			<button
				type="button"
				onClick={() => navigate(shiftMonth(month, -1))}
				disabled={isPending}
				className="rounded-xl border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
			>
				← Prev
			</button>
			<label className="text-sm font-semibold text-slate-700">
				<span className="sr-only">Cycle month</span>
				<input
					type="month"
					defaultValue={month}
					onChange={(event) => navigate(event.target.value)}
					className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
				/>
			</label>
			<button
				type="button"
				onClick={() => navigate(shiftMonth(month, 1))}
				disabled={isPending}
				className="rounded-xl border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
			>
				Next →
			</button>
			{isPending ? <span className="text-xs text-slate-500">Updating…</span> : null}
		</div>
	);
}
