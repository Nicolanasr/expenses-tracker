'use client';

import { useMemo, useState, useEffect } from 'react';

import { TransactionItem } from '@/app/_components/transaction-item';

type Transaction = {
	id: string;
	amount: number;
	type: 'income' | 'expense';
	currencyCode: string;
	occurredOn: string;
	paymentMethod: 'cash' | 'card' | 'transfer' | 'other';
	notes: string | null;
	categoryId: string | null;
	category: {
		id: string;
		name: string;
		icon: string | null;
		color: string | null;
		type: 'income' | 'expense';
	} | null;
};

type CategoryOption = {
	id: string;
	name: string;
	icon: string | null;
	color: string | null;
	type: 'income' | 'expense';
};

export function TransactionsPaginatedList({
	transactions,
	categories,
	title = "Filtered transactions",
	emptyMessage = "Adjust filters or add new transactions to see them here.",
	enableEditing = false,
	pageSizeOptions,
	filters,
}: {
	transactions: Transaction[];
	categories: CategoryOption[];
	title?: string;
	emptyMessage?: string;
	enableEditing?: boolean;
	pageSizeOptions?: number[];
	filters?: React.ReactNode;
}) {
	const options = pageSizeOptions && pageSizeOptions.length ? pageSizeOptions : [7, 14, 28, 56, 112];
	const initialPageSize = options[1] ?? options[0] ?? 10;
	const [pageSize, setPageSize] = useState(() => initialPageSize);
	const [page, setPage] = useState(1);

	useEffect(() => {
		setPage(1);
	}, [pageSize, transactions.length]);

	const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));
	const currentPage = Math.min(page, totalPages);
	const pageOffset = (currentPage - 1) * pageSize;

	const currentSlice = useMemo(() => {
		return transactions.slice(pageOffset, pageOffset + pageSize);
	}, [transactions, pageOffset, pageSize]);

	return (
		<section className="space-y-4">
			{filters ? <div>{filters}</div> : null}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-base font-semibold text-slate-900">{title}</h2>
					<p className="text-xs text-slate-500">
						Showing {transactions.length === 0 ? 0 : `${pageOffset + 1}-${Math.min(pageOffset + currentSlice.length, transactions.length)}`} of {transactions.length}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<label className="text-xs font-semibold text-slate-500">
						Show/page
						<select
							className="ml-2 rounded-xl border border-slate-200 px-3 py-1 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
							value={pageSize}
							onChange={(event) => setPageSize(Number(event.target.value))}
						>
							{options.map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
						</select>
					</label>
				</div>
			</div>

			{currentSlice.length === 0 ? (
				<p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">{emptyMessage}</p>
			) : (
				<div className="space-y-4">
					{groupByDate(currentSlice).map((group) => (
						<div key={group.key} className="space-y-2">
							<h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
								{group.label}
							</h3>
							<div className="space-y-3">
								{group.items.map((transaction) => (
									<TransactionItem
										key={transaction.id}
										transaction={transaction}
										categories={categories}
										enableEditing={enableEditing}
									/>
								))}
							</div>
						</div>
					))}
				</div>
			)}

			{totalPages > 1 ? (
				<div className="flex flex-col gap-2 pt-2 text-sm">
					<div className="flex items-center justify-between">
						<button
							type="button"
							onClick={() => setPage((prev) => Math.max(1, prev - 1))}
						disabled={currentPage === 1}
						className={`rounded-xl border px-3 py-1 font-semibold ${
							currentPage === 1
								? 'cursor-not-allowed border-slate-200 text-slate-300'
								: 'border-slate-200 text-slate-700 hover:border-indigo-200 hover:text-indigo-600'
						}`}
							>
								Previous
						</button>
						<div className="flex items-center gap-1">
							{buildPageList(totalPages, currentPage).map((entry, index) =>
								entry === 'ellipsis' ? (
									<span key={`ellipsis-${index}`} className="px-2 text-slate-400">
										...
									</span>
								) : (
									<button
										key={entry}
										type="button"
										onClick={() => setPage(entry)}
										className={`rounded-xl border px-2.5 py-1 text-sm font-semibold ${
											entry === currentPage
												? 'border-indigo-300 bg-indigo-50 text-indigo-700'
												: 'border-slate-200 text-slate-700 hover:border-indigo-200 hover:text-indigo-600'
										}`}
									>
										{entry}
									</button>
								),
							)}
						</div>
						<button
							type="button"
							onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
							disabled={currentPage === totalPages}
							className={`rounded-xl border px-3 py-1 font-semibold ${
								currentPage === totalPages
									? 'cursor-not-allowed border-slate-200 text-slate-300'
									: 'border-slate-200 text-slate-700 hover:border-indigo-200 hover:text-indigo-600'
							}`}
						>
							Next
						</button>
					</div>
					<p className="text-center text-xs text-slate-500">
						Page {currentPage} of {totalPages}
					</p>
				</div>
			) : null}
		</section>
	);
}

function buildPageList(total: number, current: number) {
	if (total <= 7) {
		return Array.from({ length: total }, (_, index) => index + 1);
	}

	const window = 2;
	const pages: (number | 'ellipsis')[] = [1];
	let start = Math.max(2, current - window);
	let end = Math.min(total - 1, current + window);

	if (start > 2) {
		pages.push('ellipsis');
	} else {
		start = 2;
	}

	for (let page = start; page <= end; page += 1) {
		pages.push(page);
	}

	if (end < total - 1) {
		pages.push('ellipsis');
	}

	pages.push(total);
	return pages;
}

function groupByDate(transactions: Transaction[]) {
	const formatter = new Intl.DateTimeFormat('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});

	const map = new Map<string, { key: string; label: string; items: Transaction[] }>();
	transactions.forEach((transaction) => {
		const date = new Date(transaction.occurredOn);
		const key = date.toISOString().slice(0, 10);
		if (!map.has(key)) {
			map.set(key, {
				key,
				label: formatter.format(date),
				items: [],
			});
		}
		map.get(key)!.items.push(transaction);
	});

	return Array.from(map.values()).sort((a, b) => new Date(b.key).getTime() - new Date(a.key).getTime());
}
