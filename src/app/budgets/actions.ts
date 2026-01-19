"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { toCents, upsertBudget } from "@/lib/budgets";
import { createSupabaseServerActionClient, type Json } from "@/lib/supabase/server";

const upsertSchema = z.object({
	id: z.preprocess((val) => (val ? String(val) : undefined), z.string().uuid().optional()),
	label: z.string().min(1).max(60),
	categoryId: z.string().uuid(),
	month: z.string().regex(/^\d{4}-(0?[1-9]|1[0-2])$/),
	amount: z.coerce.number().min(0),
	currencyCode: z.string().length(3),
	accountIds: z.array(z.string().uuid()).optional(),
});

function friendlyBudgetError(error: unknown) {
	if (error && typeof error === "object") {
		const err = error as { code?: string; message?: string };
		if (err.code === "23505") {
			return "A budget already exists for this category, account, currency, and month.";
		}
		if (typeof err.message === "string") {
			return err.message;
		}
	}
	return "Unable to save budget";
}

export async function upsertBudgetAction(formData: FormData) {
	try {
		const payload = upsertSchema.parse({
			id: formData.get("id"),
			label: formData.get("label") || "Budget",
			categoryId: formData.get("categoryId"),
			month: normalizeMonth(formData.get("month")),
			amount: formData.get("amount"),
			currencyCode: formData.get("currency_code"),
			accountIds: formData.getAll("account_ids[]").map(String).filter(Boolean),
		});

		const saved = await upsertBudget({
			id: payload.id,
			categoryId: payload.categoryId,
			month: normalizeMonth(payload.month),
			amountCents: toCents(payload.amount),
			currencyCode: payload.currencyCode,
			accountIds: payload.accountIds,
			label: payload.label,
		});

		revalidatePath("/budgets");
		return { ok: true, budgetId: saved.id };
	} catch (error) {
		const message = friendlyBudgetError(error);
		return { ok: false, error: message };
	}
}

export async function copyBudgetsAction(prevMonth: string, month: string, currencyCode: string) {
	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();
	if (error || !user) {
		throw error ?? new Error("You must be signed in.");
	}

	// Fetch source budgets for the same currency
	const { data: sourceBudgets, error: fetchError } = await supabase
		.from("budgets")
		.select("id, label, category_id, amount_cents")
		.eq("user_id", user.id)
		.eq("month", prevMonth)
		.eq("currency_code", currencyCode)
		.is("deleted_at", null);
	if (fetchError) throw fetchError;

	if (!sourceBudgets?.length) return 0;

	// Fetch linked accounts
	const sourceIds = sourceBudgets.map((b) => b.id);
	const { data: links } = await supabase.from("budget_accounts").select("budget_id, account_id").in("budget_id", sourceIds);

	let insertedCount = 0;
	for (const budget of sourceBudgets) {
		const { data: inserted, error: insertError } = await supabase
			.from("budgets")
			.insert({
				user_id: user.id,
				category_id: budget.category_id,
				month,
				currency_code: currencyCode,
				label: budget.label ?? "Budget",
				amount_cents: budget.amount_cents,
				updated_at: new Date().toISOString(),
			})
			.select("id")
			.single();
		if (insertError) {
			console.error(insertError);
			continue;
		}
		insertedCount++;
		const linkedAccounts = (links ?? [])
			.filter((l) => l.budget_id === budget.id)
			.map((l) => l.account_id)
			.filter(Boolean) as string[];
		if (linkedAccounts.length) {
			const rows = linkedAccounts.map((accountId) => ({ budget_id: inserted?.id, account_id: accountId }));
			await supabase.from("budget_accounts").insert(rows);
		}
	}

	revalidatePath("/budgets");
	return insertedCount;
}

const bulkSaveSchema = z.object({
	month: z.string().regex(/^\d{4}-(0?[1-9]|1[0-2])$/),
	currencyCode: z.string().length(3),
	budgets: z.array(
		z.object({
			id: z.preprocess((val) => (val ? String(val) : undefined), z.string().uuid().optional()),
			label: z.string().min(1).max(60),
			categoryId: z.string().uuid(),
			amount: z.number().min(0),
			accountIds: z.array(z.string().uuid()).optional(),
		})
	),
});

const deleteSchema = z.object({
	budgetId: z.string().uuid(),
});

const deleteMonthSchema = z.object({
	month: z.string().regex(/^\d{4}-(0?[1-9]|1[0-2])$/),
	currencyCode: z.string().length(3),
});

function normalizeMonth(value: unknown) {
	if (typeof value !== "string") return "";
	const trimmed = value.trim();
	const match = /^(\d{4})-(\d{1,2})$/.exec(trimmed);
	if (match) {
		return `${match[1]}-${match[2].padStart(2, "0")}`;
	}
	return trimmed;
}

export async function saveBudgetsAction(form: FormData) {
	const raw = form.get("payload");
	if (typeof raw !== "string") {
		throw new Error("Invalid payload");
	}

	const parsed = bulkSaveSchema.safeParse(JSON.parse(raw));
	if (!parsed.success) {
		throw parsed.error;
	}

	for (const item of parsed.data.budgets) {
		try {
			await upsertBudget({
				id: item.id,
				label: item.label,
				categoryId: item.categoryId,
				month: normalizeMonth(parsed.data.month),
				currencyCode: parsed.data.currencyCode,
				accountIds: item.accountIds,
				amountCents: toCents(item.amount),
			});
		} catch (error) {
			throw new Error(friendlyBudgetError(error));
		}
	}

	revalidatePath("/budgets");
}

export async function deleteBudgetAction(formData: FormData) {
	const parsed = deleteSchema.safeParse({
		budgetId: formData.get("budget_id"),
	});

	if (!parsed.success) {
		throw new Error("Invalid budget delete payload");
	}

	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();

	if (error || !user) {
		throw error ?? new Error("You must be signed in.");
	}

	const { data: existing, error: fetchError } = await supabase
		.from("budgets")
		.select("*")
		.eq("user_id", user.id)
		.eq("id", parsed.data.budgetId)
		.is("deleted_at", null)
		.maybeSingle();

	if (fetchError) {
		throw fetchError;
	}

	if (existing) {
		await supabase.from("audit_log").insert({
			user_id: user.id,
			table_name: "budgets",
			record_id: existing.id,
			action: "delete",
			snapshot: existing as unknown as Json,
		});

		const deletedAt = new Date().toISOString();
		const { error: deleteError } = await supabase
			.from("budgets")
			.update({ deleted_at: deletedAt, updated_at: deletedAt })
			.eq("user_id", user.id)
			.eq("id", parsed.data.budgetId);

		if (deleteError) {
			throw deleteError;
		}
	}

	revalidatePath("/budgets");
	return { ok: true };
}

export async function deleteMonthBudgetsAction(formData: FormData) {
	const parsed = deleteMonthSchema.safeParse({
		month: normalizeMonth(formData.get("month")),
		currencyCode: formData.get("currency_code"),
		accountId: formData.get("account_id"),
	});

	if (!parsed.success) {
		throw new Error("Invalid month");
	}

	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();

	if (error || !user) {
		throw error ?? new Error("You must be signed in.");
	}

	const { data: existingRows, error: fetchError } = await supabase
		.from("budgets")
		.select("*")
		.eq("user_id", user.id)
		.eq("month", parsed.data.month)
		.eq("currency_code", parsed.data.currencyCode)
		.is("deleted_at", null);

	if (fetchError) {
		throw fetchError;
	}

	const deletedAt = new Date().toISOString();
	const { error: deleteError } = await supabase
		.from("budgets")
		.update({ deleted_at: deletedAt, updated_at: deletedAt })
		.eq("user_id", user.id)
		.eq("month", parsed.data.month)
		.eq("currency_code", parsed.data.currencyCode);

	if (deleteError) {
		throw deleteError;
	}

	if (existingRows && existingRows.length) {
		const inserts = existingRows.map((row) => ({
			user_id: user.id,
			table_name: "budgets",
			record_id: row.id,
			action: "delete" as const,
			snapshot: row as unknown as Json,
		}));
		await supabase.from("audit_log").insert(inserts);
	}

	revalidatePath("/budgets");
	return { ok: true };
}

const thresholdsSchema = z.object({
	items: z.array(
		z.object({
			categoryId: z.string().uuid(),
			levels: z.array(z.number().min(1).max(100)).max(5),
		})
	),
});

export async function saveBudgetThresholdsAction(formData: FormData) {
	const payloadRaw = formData.get("payload");
	if (typeof payloadRaw !== "string") {
		throw new Error("Invalid payload");
	}

	const parsed = thresholdsSchema.safeParse(JSON.parse(payloadRaw));
	if (!parsed.success) {
		throw parsed.error;
	}

	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();

	if (error || !user) {
		throw error ?? new Error("You must be signed in.");
	}

	const sanitized = parsed.data.items
		.map((item) => ({
			categoryId: item.categoryId,
			levels: Array.from(new Set(item.levels.map((v) => Math.min(100, Math.max(1, Math.round(v)))))).sort((a, b) => a - b),
		}))
		.filter((item) => item.levels.length > 0);

	await supabase.from("user_settings").upsert(
		{
			user_id: user.id,
			budget_thresholds: sanitized as unknown as Json,
		},
		{ onConflict: "user_id" }
	);

	revalidatePath("/budgets");
	revalidatePath("/");
}
