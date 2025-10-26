/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerActionClient } from "@/lib/supabase/server";

export type FormState = {
	ok: boolean;
	errors?: Record<string, string[] | undefined>;
};

async function getUserCurrencyCode(supabase: Awaited<ReturnType<typeof createSupabaseServerActionClient>>, userId: string) {
	const { data, error } = await supabase.from("user_settings").select("currency_code").eq("user_id", userId).maybeSingle();

	if (error && error.code !== "PGRST116") {
		throw error;
	}

	if (data?.currency_code) {
		return data.currency_code;
	}

	const { data: inserted } = await supabase
		.from("user_settings")
		.upsert({ user_id: userId, currency_code: "USD" }, { onConflict: "user_id" })
		.select("currency_code")
		.maybeSingle();

	return inserted?.currency_code ?? "USD";
}

const categorySchema = z.object({
	name: z
		.string({ error: "Category name is required" })
		.min(2, "Category name should be at least 2 characters")
		.max(40, "Category name should be less than 40 characters"),
	type: z.enum(["income", "expense"]),
	icon: z
		.string({ error: "Icon is required" })
		.min(1, "Pick an emoji to help recognize the category")
		.max(4, "Keep the icon short (use a single emoji)"),
	color: z
		.string()
		.regex(/^#([0-9a-f]{3}){1,2}$/i, "Provide a valid hex color")
		.default("#6366f1"),
});

const transactionSchema = z.object({
	amount: z
		.string({ error: "Amount is required" })
		.transform((val) => Number(val))
		.refine((val) => !Number.isNaN(val) && val > 0, {
			message: "Amount must be a positive number",
		}),
	occurred_on: z.string().min(1, "Date is required"),
	category_id: z.string().uuid({ message: "Pick a valid category" }),
	payment_method: z.enum(["cash", "card", "transfer", "other"]),
	notes: z.string().optional(),
});

const transactionUpdateSchema = transactionSchema.extend({
	id: z.string().uuid({ message: "Missing transaction id" }),
});

const transactionDeleteSchema = z.object({
	id: z.string().uuid({ message: "Missing transaction id" }),
});

export async function createCategory(_: unknown, formData: FormData) {
	const payload = categorySchema.safeParse({
		name: formData.get("name"),
		type: formData.get("type"),
		icon: formData.get("icon") ?? "🏷️",
		color: formData.get("color") ?? "#6366f1",
	});

	if (!payload.success) {
		return {
			ok: false,
			errors: payload.error.flatten().fieldErrors,
		};
	}

	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		return {
			ok: false,
			errors: {
				name: ["You must be signed in to add categories."],
			},
		};
	}

	const { error } = await supabase.from("categories").insert({
		name: payload.data.name.trim(),
		type: payload.data.type,
		icon: payload.data.icon,
		user_id: user.id,
		color: payload.data.color,
	});

	if (error) {
		console.error(error);
		return {
			ok: false,
			errors: { name: ["Unable to save category, try again."] },
		};
	}

	revalidatePath("/");
	revalidatePath("/categories");
	revalidatePath("/transactions");
	return { ok: true };
}

export async function createTransaction(_: unknown, formData: FormData) {
	const supabase = await createSupabaseServerActionClient();

	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		return {
			ok: false,
			errors: {
				category_id: ["You must be signed in to record transactions."],
			},
		};
	}

	const currencyCode = await getUserCurrencyCode(supabase, user.id);

	const categoriesResponse = await supabase.from("categories").select("id, type");

	if (categoriesResponse.error) {
		console.error(categoriesResponse.error);
		return {
			ok: false,
			errors: {
				category_id: ["Unable to validate categories."],
			},
		};
	}

	const payload = transactionSchema.safeParse({
		amount: formData.get("amount"),
		category_id: formData.get("category_id"),
		occurred_on: formData.get("occurred_on"),
		payment_method: formData.get("payment_method"),
		notes: formData.get("notes"),
	});

	if (!payload.success) {
		return {
			ok: false,
			errors: payload.error.flatten().fieldErrors,
		};
	}

	const category: any = categoriesResponse.data.find((item: any) => item.id === payload.data.category_id);

	if (!category) {
		return {
			ok: false,
			errors: {
				category_id: ["Pick a category before creating a transaction."],
			},
		};
	}

	const { error } = await supabase.from("transactions").insert({
		amount: payload.data.amount,
		occurred_on: payload.data.occurred_on,
		payment_method: payload.data.payment_method,
		notes: payload.data.notes ?? null,
		category_id: payload.data.category_id,
		type: category.type,
		user_id: user.id,
		currency_code: currencyCode,
	});

	if (error) {
		console.error(error);
		return {
			ok: false,
			errors: { amount: ["Unable to record transaction, try again."] },
		};
	}

	revalidatePath("/");
	revalidatePath("/transactions");
	return { ok: true };
}

export async function updateTransaction(_prevState: FormState, formData: FormData): Promise<FormState> {
	const supabase = await createSupabaseServerActionClient();

	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		return {
			ok: false,
			errors: {
				amount: ["You must be signed in to update transactions."],
			},
		};
	}

	const payload = transactionUpdateSchema.safeParse({
		id: formData.get("id"),
		amount: formData.get("amount"),
		category_id: formData.get("category_id"),
		occurred_on: formData.get("occurred_on"),
		payment_method: formData.get("payment_method"),
		notes: formData.get("notes"),
	});

	if (!payload.success) {
		return {
			ok: false,
			errors: payload.error.flatten().fieldErrors,
		};
	}

	const categoriesResponse = await supabase.from("categories").select("id, type").eq("user_id", user.id);

	if (categoriesResponse.error) {
		console.error(categoriesResponse.error);
		return {
			ok: false,
			errors: {
				category_id: ["Unable to validate categories."],
			},
		};
	}

	const category = (categoriesResponse.data ?? []).find((item) => item.id === payload.data.category_id);

	if (!category) {
		return {
			ok: false,
			errors: {
				category_id: ["Pick a category before updating the transaction."],
			},
		};
	}

	const { error } = await supabase
		.from("transactions")
		.update({
			amount: payload.data.amount,
			occurred_on: payload.data.occurred_on,
			payment_method: payload.data.payment_method,
			notes: payload.data.notes ?? null,
			category_id: payload.data.category_id,
			type: category.type,
		})
		.eq("id", payload.data.id)
		.eq("user_id", user.id);

	if (error) {
		console.error(error);
		return {
			ok: false,
			errors: { amount: ["Unable to update transaction, try again."] },
		};
	}

	revalidatePath("/");
	revalidatePath("/transactions");
	return { ok: true };
}

export async function deleteTransaction(formData: FormData) {
	const payload = transactionDeleteSchema.safeParse({
		id: formData.get("id"),
	});

	if (!payload.success) {
		return;
	}

	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return;
	}

	const { error } = await supabase.from("transactions").delete().eq("id", payload.data.id).eq("user_id", user.id);

	if (error) {
		console.error(error);
	}

	revalidatePath("/");
	revalidatePath("/transactions");
}
