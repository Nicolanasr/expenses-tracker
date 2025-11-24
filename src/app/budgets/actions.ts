"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { copyBudgets, toCents, upsertBudget } from "@/lib/budgets";
import { createSupabaseServerActionClient, type Json } from "@/lib/supabase/server";

const upsertSchema = z.object({
	categoryId: z.string().uuid(),
	month: z.string().regex(/^\d{4}-\d{2}$/),
	amount: z.coerce.number().min(0),
});

export async function upsertBudgetAction(formData: FormData) {
	const payload = upsertSchema.parse({
		categoryId: formData.get("categoryId"),
		month: formData.get("month"),
		amount: formData.get("amount"),
	});

	await upsertBudget({
		categoryId: payload.categoryId,
		month: payload.month,
		amountCents: toCents(payload.amount),
	});

	revalidatePath("/budgets");
}

export async function copyBudgetsAction(prevMonth: string, month: string) {
	const inserted = await copyBudgets(prevMonth, month);
	revalidatePath("/budgets");
	return inserted;
}

const bulkSaveSchema = z.object({
	month: z.string().regex(/^\d{4}-\d{2}$/),
	items: z.array(
		z.object({
			categoryId: z.string().uuid(),
			amount: z.number().min(0),
		})
	),
});

const deleteSchema = z.object({
	month: z.string().regex(/^\d{4}-\d{2}$/),
	categoryId: z.string().uuid(),
});

const deleteMonthSchema = z.object({
	month: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function saveBudgetsAction(form: FormData) {
	const raw = form.get("payload");
	if (typeof raw !== "string") {
		throw new Error("Invalid payload");
	}

	const parsed = bulkSaveSchema.safeParse(JSON.parse(raw));
	if (!parsed.success) {
		throw parsed.error;
	}

	await Promise.all(
		parsed.data.items.map((item) =>
			upsertBudget({
				categoryId: item.categoryId,
				month: parsed.data.month,
				amountCents: toCents(item.amount),
			})
		)
	);

	revalidatePath("/budgets");
}

export async function deleteBudgetAction(formData: FormData) {
	const parsed = deleteSchema.safeParse({
		month: formData.get("month"),
		categoryId: formData.get("categoryId"),
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
		.eq("category_id", parsed.data.categoryId)
		.eq("month", parsed.data.month)
		.is("deleted_at", null)
		.maybeSingle();

	if (fetchError) {
		throw fetchError;
	}

	if (existing) {
		const deletedAt = new Date().toISOString();
		const { error: deleteError } = await supabase
			.from("budgets")
			.update({ deleted_at: deletedAt, updated_at: deletedAt })
			.eq("user_id", user.id)
			.eq("category_id", parsed.data.categoryId)
			.eq("month", parsed.data.month);

		if (!deleteError) {
			await supabase.from("audit_log").insert({
				user_id: user.id,
				table_name: "budgets",
				record_id: existing.id,
				action: "delete",
				snapshot: existing as unknown as Json,
			});
		}
		if (deleteError) {
			throw deleteError;
		}
	}

	revalidatePath("/budgets");
	return { ok: true };
}

export async function deleteMonthBudgetsAction(formData: FormData) {
	const parsed = deleteMonthSchema.safeParse({
		month: formData.get("month"),
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
		.is("deleted_at", null);

	if (fetchError) {
		throw fetchError;
	}

	const deletedAt = new Date().toISOString();
	const { error: deleteError } = await supabase
		.from("budgets")
		.update({ deleted_at: deletedAt, updated_at: deletedAt })
		.eq("user_id", user.id)
		.eq("month", parsed.data.month);

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
