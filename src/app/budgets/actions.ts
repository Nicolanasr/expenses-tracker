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
