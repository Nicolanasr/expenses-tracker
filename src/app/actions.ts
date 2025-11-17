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
	updated_at: z.string().optional(),
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
		updated_at: formData.get("updated_at"),
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

	let query = supabase
		.from("transactions")
		.update({
			amount: payload.data.amount,
			occurred_on: payload.data.occurred_on,
			payment_method: payload.data.payment_method,
			notes: payload.data.notes ?? null,
			category_id: payload.data.category_id,
			type: category.type,
			updated_at: new Date().toISOString(),
		})
		.eq("id", payload.data.id)
		.eq("user_id", user.id);

	if (payload.data.updated_at) {
		query = query.eq("updated_at", payload.data.updated_at);
	}

	const { data: updated, error } = await query.select("id, updated_at").maybeSingle();

	if (error) {
		console.error(error);
		return {
			ok: false,
			errors: { amount: ["Unable to update transaction, try again."] },
		};
	}

	if (!updated) {
		return {
			ok: false,
			errors: { amount: ["This transaction changed elsewhere. Refresh and try again."] },
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

export async function deleteTransactionById(id: string, version?: string) {
	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not signed in");
	}

	let query = supabase.from("transactions").delete().eq("id", id).eq("user_id", user.id);
	if (version) {
		query = query.eq("updated_at", version);
	}

	const { data, error } = await query
		.select("id, amount, occurred_on, payment_method, notes, category_id, type, currency_code")
		.maybeSingle();

	if (error) {
		throw error;
	}

	if (!data) {
		throw new Error("Transaction not found or already changed.");
	}

	revalidatePath("/");
	revalidatePath("/transactions");
	return data;
}

export async function restoreTransaction(payload: {
	id: string;
	amount: number;
	occurred_on: string;
	payment_method: "cash" | "card" | "transfer" | "other";
	notes: string | null;
	category_id: string | null;
	type: "income" | "expense";
	currency_code: string;
}) {
	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not signed in");
	}

	const { error } = await supabase
		.from("transactions")
		.upsert(
			{
				id: payload.id,
				amount: payload.amount,
				occurred_on: payload.occurred_on,
				payment_method: payload.payment_method,
				notes: payload.notes,
				category_id: payload.category_id,
				type: payload.type,
				currency_code: payload.currency_code,
				user_id: user.id,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "id" },
		);

	if (error) {
		throw error;
	}

	revalidatePath("/");
	revalidatePath("/transactions");
}
