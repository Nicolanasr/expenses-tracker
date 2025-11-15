'use client';

import { useMemo, useState, useTransition } from 'react';

import { copyBudgetsAction } from '@/app/budgets/actions';
import { shiftMonth } from '@/lib/pay-cycle';

type MonthOption = {
	month: string;
	totalCents: number;
};

export function CopyBudgetsButton({
	month,
	months,
	currencyCode,
}: {
	month: string;
	months: MonthOption[];
	currencyCode: string;
}) {
	const [isPending, startTransition] = useTransition();
	const formatter = useMemo(() => new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }), [currencyCode]);
	const defaultSource = useMemo(() => {
		const prev = shiftMonth(month, -1);
		const hasPrev = months.find((item) => item.month === prev);
		return hasPrev?.month ?? months[0]?.month ?? month;
	}, [month, months]);
	const [sourceMonth, setSourceMonth] = useState(defaultSource);
	const [copied, setCopied] = useState<number | null>(null);

	const handleCopy = () => {
		if (!sourceMonth) return;
		startTransition(async () => {
			const inserted = await copyBudgetsAction(sourceMonth, month);
			setCopied(inserted);
		});
	};

	if (months.length === 0) {
		return (
			<p className="text-xs text-slate-500">
				Add budgets to previous months to enable copying into {month}.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			<label className="text-sm font-semibold text-slate-700">
				<span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Copy from</span>
				<select
					value={sourceMonth}
					onChange={(event) => setSourceMonth(event.target.value)}
					className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
				>
					{months.map((option) => (
						<option key={option.month} value={option.month}>
							{option.month} — {formatter.format(option.totalCents / 100)} planned
						</option>
					))}
				</select>
			</label>
			<button
				type="button"
				onClick={handleCopy}
				disabled={isPending}
				className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
			>
				Copy to {month}
			</button>
			{copied !== null ? (
				<span className="text-xs text-slate-500">
					{copied === 0 ? 'Nothing copied (rows already exist).' : `${copied} categories copied.`}
				</span>
			) : null}
		</div>
	);
}
