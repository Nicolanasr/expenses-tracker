// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
// Supabase Edge Function: Auto-log due recurring transactions.
// Schedule suggestion: every 6 hours.
// Deploy: supabase functions deploy recurring-run
// Schedule: supabase functions schedule create recurring-runner --func recurring-run --cron "0 */6 * * *"

import { serve } from "https://deno.land/std@0.177.1/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

type Frequency = "daily" | "weekly" | "monthly" | "yearly";
type PaymentMethod = "cash" | "card" | "transfer" | "bank_transfer" | "account_transfer" | "other";
type RecurringRule = {
	id: string;
	user_id: string;
	name: string | null;
	amount: number;
	type: "income" | "expense";
	category_id: string | null;
	account_id: string | null;
	payment_method: PaymentMethod;
	notes: string | null;
	next_run_on: string;
	frequency: Frequency;
	auto_log: boolean;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
	console.error("[recurring-run] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
	global: { headers: { "x-client-info": "recurring-runner/1.0" } },
});

function advanceDate(dateStr: string, frequency: Frequency) {
	const d = new Date(`${dateStr}T00:00:00Z`);
	switch (frequency) {
		case "daily":
			d.setUTCDate(d.getUTCDate() + 1);
			break;
		case "weekly":
			d.setUTCDate(d.getUTCDate() + 7);
			break;
		case "monthly":
			d.setUTCMonth(d.getUTCMonth() + 1);
			break;
		case "yearly":
			d.setUTCFullYear(d.getUTCFullYear() + 1);
			break;
		default:
			d.setUTCDate(d.getUTCDate() + 1);
	}
	return d.toISOString().slice(0, 10);
}

async function getCurrencyCode(userId: string, cache: Map<string, string>) {
	if (cache.has(userId)) return cache.get(userId)!;
	const { data, error } = await supabase.from("user_settings").select("currency_code").eq("user_id", userId).maybeSingle();

	if (error) {
		console.error("[recurring-run] user_settings error", userId, error);
		cache.set(userId, "USD");
		return "USD";
	}
	const code = data?.currency_code ?? "USD";
	cache.set(userId, code);
	return code;
}

serve(async () => {
	const today = new Date();
	const todayKey = today.toISOString().slice(0, 10);
	const settingsCache = new Map<string, string>();

	const { data: dueRulesRaw, error: dueError } = await supabase
		.from("recurring_transactions")
		.select("id, user_id, name, amount, type, category_id, account_id, payment_method, notes, next_run_on, frequency, auto_log")
		.eq("auto_log", true)
		.lte("next_run_on", todayKey);
	const dueRules = (dueRulesRaw ?? []) as RecurringRule[];

	if (dueError) {
		console.error("[recurring-run] fetch error", dueError);
		return new Response(JSON.stringify({ ok: false, error: dueError.message }), { status: 500 });
	}

	if (!dueRules?.length) {
		return new Response(JSON.stringify({ ok: true, processed: 0 }), {
			status: 200,
		});
	}

	let processed = 0;
	let failed = 0;

	for (const rule of dueRules) {
		try {
			const currencyCode = await getCurrencyCode(rule.user_id, settingsCache);
			const occurredOn = rule.next_run_on ?? todayKey;

			const { data: inserted, error: insertError } = await supabase
				.from("transactions")
				.insert({
					user_id: rule.user_id,
					amount: rule.amount,
					type: rule.type,
					category_id: rule.category_id,
					account_id: rule.account_id,
					payment_method: rule.payment_method,
					notes: rule.notes ?? null,
					occurred_on: occurredOn,
					currency_code: currencyCode,
					recurring_transaction_id: rule.id,
					payee: rule.name ?? null,
				})
				.select("id")
				.single();

			if (insertError) {
				failed += 1;
				console.error("[recurring-run] insert transaction error", rule.id, insertError);
				continue;
			}

			const nextRun = advanceDate(rule.next_run_on ?? todayKey, (rule.frequency as Frequency) ?? "monthly");

			const { error: updateError } = await supabase
				.from("recurring_transactions")
				.update({ next_run_on: nextRun, updated_at: new Date().toISOString() })
				.eq("id", rule.id)
				.eq("user_id", rule.user_id);

			if (updateError) {
				failed += 1;
				console.error("[recurring-run] update schedule error", rule.id, updateError);
				continue;
			}

			const { error: notifyError } = await supabase.from("notifications").insert({
				user_id: rule.user_id,
				title: `Logged recurring: ${rule.name ?? "Transaction"}`,
				body: `Recorded ${rule.type === "income" ? "income" : "expense"} for ${rule.amount} on ${occurredOn}.`,
				type: "recurring_logged",
				reference_id: rule.id,
				metadata: { occurredOn, amount: rule.amount, type: rule.type },
			});

			if (notifyError) {
				console.error("[recurring-run] notify error", rule.id, notifyError);
			}

			processed += 1;
		} catch (error) {
			failed += 1;
			console.error("[recurring-run] unexpected error", error);
		}
	}

	return new Response(JSON.stringify({ ok: true, processed, failed, total: dueRules.length }), { status: 200 });
});
