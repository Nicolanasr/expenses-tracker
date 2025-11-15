"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { copyBudgets, toCents, upsertBudget } from "@/lib/budgets";

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
		}),
	),
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
			}),
		),
	);

	revalidatePath("/budgets");
}
