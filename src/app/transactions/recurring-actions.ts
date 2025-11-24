"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { insertNotification, markNotificationsAsRead } from "@/lib/notifications";

const recurringSchema = z.object({
	name: z.string({ error: "Name is required" }).min(2, "Name is too short").max(60, "Keep it under 60 characters"),
	amount: z
		.string({ error: "Amount is required" })
		.transform((value) => Number(value))
		.refine((value) => !Number.isNaN(value) && value > 0, "Enter a valid amount"),
	type: z.enum(["income", "expense"]),
	category_id: z
		.string()
		.uuid()
		.optional()
		.or(z.literal(""))
		.transform((value) => (value ? value : null)),
	account_id: z
		.string()
		.uuid()
		.optional()
		.or(z.literal(""))
		.transform((value) => (value ? value : null)),
	payment_method: z.enum(["cash", "card", "bank_transfer", "account_transfer", "other"]),
	notes: z
		.string()
		.max(160, "Notes are too long")
		.optional()
		.or(z.literal(""))
		.transform((value) => (value ? value : null)),
	frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
	first_run_on: z.string({ error: "First run date is required" }),
	auto_log: z
		.string()
		.optional()
		.transform((value) => value === "on"),
});

const runSchema = z.object({
	id: z.string().uuid(),
});

function addPeriod(dateString: string, frequency: "daily" | "weekly" | "monthly" | "yearly"): string {
	const date = new Date(dateString);
	if (Number.isNaN(date.getTime())) {
		return new Date().toISOString().slice(0, 10);
	}
	if (frequency === "daily") {
		date.setDate(date.getDate() + 1);
	} else if (frequency === "weekly") {
		date.setDate(date.getDate() + 7);
	} else if (frequency === "monthly") {
		const day = date.getDate();
		date.setMonth(date.getMonth() + 1);
		const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
		date.setDate(Math.min(day, lastDayOfMonth));
	} else {
		// yearly
		const day = date.getDate();
		const month = date.getMonth();
		date.setFullYear(date.getFullYear() + 1);
		const lastDayOfMonth = new Date(date.getFullYear(), month + 1, 0).getDate();
		date.setMonth(month);
		date.setDate(Math.min(day, lastDayOfMonth));
	}
	return date.toISOString().slice(0, 10);
}

async function ensureUserCurrency(supabase: ReturnType<typeof createSupabaseServerActionClient>, userId: string): Promise<string> {
	const { data, error } = await (await supabase).from("user_settings").select("currency_code").eq("user_id", userId).maybeSingle();

	if (error && error.code !== "PGRST116") {
		throw error;
	}
	return data?.currency_code ?? "USD";
}

export type RecurringFormState = {
	ok: boolean;
	errors?: Record<string, string[] | undefined>;
	message?: string;
};

export async function createRecurringRuleAction(_prev: RecurringFormState, formData: FormData): Promise<RecurringFormState> {
	const payload = recurringSchema.safeParse({
		name: formData.get("name"),
		amount: formData.get("amount"),
		type: formData.get("type"),
		category_id: formData.get("category_id"),
		account_id: formData.get("account_id"),
		payment_method: formData.get("payment_method"),
		notes: formData.get("notes"),
		frequency: formData.get("frequency"),
		first_run_on: formData.get("first_run_on"),
		auto_log: formData.get("auto_log"),
	});

	if (!payload.success) {
		return { ok: false, errors: payload.error.flatten().fieldErrors };
	}

	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();

	if (error || !user) {
		return { ok: false, message: "Sign in to save a recurring transaction." };
	}

	const nextRun = payload.data.first_run_on;
	const { error: insertError } = await supabase.from("recurring_transactions").insert({
		user_id: user.id,
		name: payload.data.name.trim(),
		amount: payload.data.amount,
		type: payload.data.type,
		category_id: payload.data.category_id,
		account_id: payload.data.account_id,
		payment_method: payload.data.payment_method,
		notes: payload.data.notes,
		frequency: payload.data.frequency,
		next_run_on: nextRun,
		auto_log: payload.data.auto_log,
	});

	if (insertError) {
		console.error(insertError);
		return { ok: false, message: "Unable to save recurring transaction." };
	}

	revalidatePath("/transactions");
	return { ok: true };
}

export async function deleteRecurringRuleAction(_prev: RecurringFormState, formData: FormData): Promise<RecurringFormState> {
	const id = formData.get("recurring_id")?.toString();
	if (!id) {
		return { ok: false, message: "Missing recurring id." };
	}

	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();
	if (error || !user) {
		return { ok: false, message: "Sign in to continue." };
	}

	const { data: existing, error: fetchError } = await supabase
		.from("recurring_transactions")
		.select("*")
		.eq("id", id)
		.eq("user_id", user.id)
		.is("deleted_at", null)
		.maybeSingle();

	if (fetchError) {
		console.error(fetchError);
		return { ok: false, message: "Unable to delete recurring transaction." };
	}

	if (existing) {
		const deletedAt = new Date().toISOString();
		const { error: deleteError } = await supabase
			.from("recurring_transactions")
			.update({ deleted_at: deletedAt, updated_at: deletedAt })
			.eq("id", id)
			.eq("user_id", user.id);

		if (deleteError) {
			console.error(deleteError);
			return { ok: false, message: "Unable to delete recurring transaction." };
		}

		await supabase.from("audit_log").insert({
			user_id: user.id,
			table_name: "recurring_transactions",
			record_id: id,
			action: "delete",
			snapshot: existing as unknown as Record<string, unknown>,
		});
	}

	revalidatePath("/transactions");
	return { ok: true };
}

export async function runRecurringRuleAction(_prev: RecurringFormState, formData: FormData): Promise<RecurringFormState> {
	const parsed = runSchema.safeParse({
		id: formData.get("recurring_id"),
	});
	if (!parsed.success) {
		return { ok: false, message: "Invalid recurrence." };
	}

	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();

	if (error || !user) {
		return { ok: false, message: "Sign in to continue." };
	}

	const { data: rule, error: fetchError } = await supabase
		.from("recurring_transactions")
		.select("id, name, amount, type, payment_method, notes, category_id, account_id, frequency, next_run_on")
		.eq("id", parsed.data.id)
		.eq("user_id", user.id)
		.is("deleted_at", null)
		.maybeSingle();

	if (fetchError || !rule) {
		return { ok: false, message: "Recurring entry not found." };
	}

	const currencyCode = await ensureUserCurrency(supabase, user.id);
	const { error: insertError } = await supabase.from("transactions").insert({
		user_id: user.id,
		amount: rule.amount,
		type: rule.type,
		category_id: rule.category_id,
		account_id: rule.account_id,
		payment_method: rule.payment_method,
		notes: rule.notes,
		payee: rule.name,
		occurred_on: rule.next_run_on,
		currency_code: currencyCode,
		recurring_transaction_id: rule.id,
	});

	if (insertError) {
		console.error(insertError);
		return { ok: false, message: "Unable to log transaction." };
	}

	const nextRun = addPeriod(rule.next_run_on, rule.frequency as "daily" | "weekly" | "monthly" | "yearly");
	await supabase
		.from("recurring_transactions")
		.update({ next_run_on: nextRun, updated_at: new Date().toISOString() })
		.eq("id", rule.id)
		.eq("user_id", user.id);

	await insertNotification(supabase, user.id, {
		title: `Recurring transaction logged`,
		body: `${rule.name} logged manually for ${new Date(rule.next_run_on).toLocaleDateString('en-US')}`,
		type: "recurring_logged",
		referenceId: rule.id,
		sendEmail: true,
		userEmail: user.email,
	});
	await markNotificationsAsRead(supabase, user.id, rule.id);

	revalidatePath("/transactions");
	return { ok: true };
}
