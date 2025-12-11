"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type Category = { id: string; name: string | null };

type Props = {
	categories: Category[];
	initialStart: string;
	initialEnd: string;
	initialCategory?: string;
};

export default function InsightsFilters({ categories, initialStart, initialEnd, initialCategory }: Props) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [start, setStart] = useState(initialStart);
	const [end, setEnd] = useState(initialEnd);
	const [category, setCategory] = useState(initialCategory ?? "");
	const [pending, startTransition] = useTransition();

	const queryBase = useMemo(() => {
		const params = new URLSearchParams(searchParams?.toString() ?? "");
		return params;
	}, [searchParams]);

	const apply = () => {
		const params = new URLSearchParams(queryBase.toString());
		params.set("start", start);
		params.set("end", end);
		if (category) params.set("category", category);
		else params.delete("category");
		startTransition(() => router.replace(`/insights?${params.toString()}`));
	};

	const reset = () => {
		setStart(initialStart);
		setEnd(initialEnd);
		setCategory(initialCategory ?? "");
		startTransition(() => router.replace("/insights"));
	};

	return (
		<div className="mt-4 grid gap-3 sm:grid-cols-3">
			<label className="grid gap-1 text-xs font-semibold text-slate-700">
				Start date
				<input
					name="start"
					type="date"
					value={start}
					onChange={(e) => setStart(e.target.value)}
					className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
				/>
			</label>
			<label className="grid gap-1 text-xs font-semibold text-slate-700">
				End date
				<input
					name="end"
					type="date"
					value={end}
					onChange={(e) => setEnd(e.target.value)}
					className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
				/>
			</label>
			<label className="grid gap-1 text-xs font-semibold text-slate-700">
				Category
				<select
					name="category"
					value={category}
					onChange={(e) => setCategory(e.target.value)}
					className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
				>
					<option value="">All categories</option>
					{categories.map((cat) => (
						<option key={cat.id} value={cat.id}>
							{cat.name ?? "Untitled"}
						</option>
					))}
				</select>
			</label>
			<div className="sm:col-span-3 flex justify-end gap-2">
				<button
					type="button"
					onClick={reset}
					className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
					disabled={pending}
				>
					Reset
				</button>
				<button
					type="button"
					onClick={apply}
					disabled={pending}
					className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
				>
					{pending ? "Applying..." : "Apply filters"}
				</button>
			</div>
		</div>
	);
}
