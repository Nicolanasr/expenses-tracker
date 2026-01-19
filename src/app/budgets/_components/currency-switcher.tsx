"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = {
	month: string;
	current: string;
	options: string[];
};

export function CurrencySwitcher({ month, current, options }: Props) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	return (
		<form
			className="inline-flex items-center gap-2"
			onChange={(e) => {
				const select = e.target as HTMLSelectElement;
				if (select.name !== "currency") return;
				const params = new URLSearchParams();
				params.set("month", month);
				params.set("currency", select.value);
				if (typeof window !== "undefined") {
					window.dispatchEvent(new CustomEvent("budget:currency-switch", { detail: { state: "pending" } }));
				}
				startTransition(() => {
					router.replace(`/budgets?${params.toString()}`);
				});
			}}
		>
			<input type="hidden" name="month" value={month} />
			<select
				name="currency"
				defaultValue={current}
				disabled={isPending}
				className="h-9 rounded-lg border border-slate-200 px-2 text-sm disabled:opacity-60"
			>
				{options.map((c) => (
					<option key={c} value={c}>
						{c}
					</option>
				))}
			</select>
		</form>
	);
}
