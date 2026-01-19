/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerActionClient, type Json } from "@/lib/supabase/server";
import { processBudgetThresholds } from "@/lib/budgets";

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
	payment_method: z.enum(["card", "cash", "bank_transfer", "account_transfer", "other"]),
	notes: z.string().optional(),
	account_id: z
		.string()
		.uuid({ message: "Pick a valid account" })
		.optional()
		.or(z.literal(""))
		.transform((val) => (val ? val : undefined)),
	payee: z
		.string()
		.max(120, "Payee is too long")
		.optional()
		.or(z.literal(""))
		.transform((val) => (val ? val : undefined)),
	recurring_enabled: z
		.preprocess((val) => (val === null ? undefined : val), z.enum(["on", "off"]).optional()),
	recurring_frequency: z
		.preprocess((val) => (val === null ? undefined : val), z.enum(["daily", "weekly", "monthly", "yearly"]).optional()),
	recurring_first_run_on: z.preprocess((val) => (val === null ? undefined : val), z.string().optional()),
	recurring_auto_log: z.enum(["on", "off"]).optional(),
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

	const [categoriesResponse, accountsResponse] = await Promise.all([
		supabase.from("categories").select("id, type"),
		supabase.from("accounts").select("id, currency_code").eq("user_id", user.id),
	]);

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
		account_id: formData.get("account_id"),
		payee: formData.get("payee"),
		recurring_enabled: formData.get("recurring_enabled"),
		recurring_frequency: formData.get("recurring_frequency"),
		recurring_first_run_on: formData.get("recurring_first_run_on"),
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

	let accountId: string | undefined;
	let accountCurrency: string | undefined;
	if (payload.data.account_id) {
		const account = (accountsResponse.data ?? []).find((account) => account.id === payload.data.account_id);
		const ownsAccount = Boolean(account);
		if (!ownsAccount) {
			return {
				ok: false,
				errors: { account_id: ["Pick one of your accounts."] },
			};
		}
		accountId = payload.data.account_id;
		accountCurrency = account?.currency_code ?? undefined;
	}
	const currencyCode = accountCurrency ?? (await getUserCurrencyCode(supabase, user.id));

	const isRecurring = payload.data.recurring_enabled === "on";
	if (isRecurring && !payload.data.recurring_first_run_on) {
		return {
			ok: false,
			errors: { recurring_first_run_on: ["Pick the next run date for the recurring schedule."] },
		};
	}

	const firstRun = payload.data.recurring_first_run_on || payload.data.occurred_on;
	const shouldDelayFirstRun = isRecurring && firstRun > payload.data.occurred_on;
	let insertedTransactionId: string | null = null;

	if (!shouldDelayFirstRun) {
		const { data: insertedTransaction, error } = await supabase
			.from("transactions")
			.insert({
				amount: payload.data.amount,
				occurred_on: payload.data.occurred_on,
				payment_method: payload.data.payment_method,
				notes: payload.data.notes ?? null,
				account_id: accountId ?? null,
				payee: payload.data.payee ?? null,
				category_id: payload.data.category_id,
				type: category.type,
				user_id: user.id,
				currency_code: currencyCode,
			})
			.select("id")
			.single();

		if (error) {
			console.error(error);
			return {
				ok: false,
				errors: { amount: ["Unable to record transaction, try again."] },
			};
		}

		insertedTransactionId = insertedTransaction?.id ?? null;
	}
	// Fire budget threshold alerts for expenses
	if (category.type === "expense") {
		processBudgetThresholds(supabase, user.id, user.email).catch((err) => console.error("[budget-thresholds] create", err));
	}

	if (isRecurring) {
		const nextRun = firstRun;
		const frequency = payload.data.recurring_frequency || "monthly";
	const autoLog = payload.data.recurring_auto_log !== "off";
		const ruleName = payload.data.payee || (category?.name as string) || "Recurring transaction";
		const { data: insertedRule } = await supabase
			.from("recurring_transactions")
			.insert({
			user_id: user.id,
			name: ruleName,
			amount: payload.data.amount,
			type: category.type,
			category_id: payload.data.category_id,
			account_id: accountId ?? null,
			payment_method: payload.data.payment_method,
			notes: payload.data.notes ?? null,
			auto_log: autoLog,
			frequency,
			next_run_on: nextRun,
		})
		.select("id")
		.single();
		if (insertedTransactionId && insertedRule?.id) {
			await supabase
				.from("transactions")
				.update({ recurring_transaction_id: insertedRule.id })
				.eq("id", insertedTransactionId)
				.eq("user_id", user.id);
		}
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
		account_id: formData.get("account_id"),
		payee: formData.get("payee"),
	});

	if (!payload.success) {
		return {
			ok: false,
			errors: payload.error.flatten().fieldErrors,
		};
	}

	const [categoriesResponse, accountsResponse] = await Promise.all([
		supabase.from("categories").select("id, type").eq("user_id", user.id),
		supabase.from("accounts").select("id, currency_code").eq("user_id", user.id),
	]);

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

	let accountId: string | undefined;
	let accountCurrency: string | undefined;
	if (payload.data.account_id) {
		const account = (accountsResponse.data ?? []).find((account) => account.id === payload.data.account_id);
		const ownsAccount = Boolean(account);
		if (!ownsAccount) {
			return {
				ok: false,
				errors: { account_id: ["Pick one of your accounts."] },
			};
		}
		accountId = payload.data.account_id;
		accountCurrency = account?.currency_code ?? undefined;
	}

	let query = supabase
		.from("transactions")
		.update({
			amount: payload.data.amount,
			occurred_on: payload.data.occurred_on,
			payment_method: payload.data.payment_method,
			notes: payload.data.notes ?? null,
			account_id: accountId ?? null,
			payee: payload.data.payee ?? null,
			category_id: payload.data.category_id,
			type: category.type,
			currency_code: accountCurrency ?? undefined,
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

	if (category.type === "expense") {
		processBudgetThresholds(supabase, user.id, user.email).catch((err) => console.error("[budget-thresholds] update", err));
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

	const { data: existing, error: fetchError } = await supabase
		.from("transactions")
		.select("*")
		.eq("id", payload.data.id)
		.eq("user_id", user.id)
		.is("deleted_at", null)
		.maybeSingle();

	if (fetchError) {
		console.error(fetchError);
	} else if (existing) {
		const deletedAt = new Date().toISOString();
		const { error } = await supabase
			.from("transactions")
			.update({ deleted_at: deletedAt, updated_at: deletedAt })
			.eq("id", payload.data.id)
			.eq("user_id", user.id);

		if (error) {
			console.error(error);
		} else {
			await supabase.from("audit_log").insert({
				user_id: user.id,
				table_name: "transactions",
				record_id: payload.data.id,
				action: "delete",
				snapshot: existing as any,
			});
		}
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

	const { data: existing, error: fetchError } = await supabase
		.from("transactions")
		.select(
			"id, amount, occurred_on, payment_method, notes, payee, account_id, category_id, type, currency_code, updated_at"
		)
		.eq("id", id)
		.eq("user_id", user.id)
		.is("deleted_at", null)
		.maybeSingle();

	if (fetchError) {
		throw fetchError;
	}

	if (!existing) {
		throw new Error("Transaction not found or already changed.");
	}

	if (version && existing.updated_at !== version) {
		throw new Error("Transaction was updated elsewhere.");
	}

	const deletedAt = new Date().toISOString();
	const { error } = await supabase
		.from("transactions")
		.update({ deleted_at: deletedAt, updated_at: deletedAt })
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) {
		throw error;
	}

	await supabase.from("audit_log").insert({
		user_id: user.id,
		table_name: "transactions",
		record_id: id,
		action: "delete",
		snapshot: existing as any,
	});

	revalidatePath("/");
	revalidatePath("/transactions");
	return existing;
}

export async function bulkDeleteTransactions(ids: string[]) {
	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not signed in");
	}
	if (!Array.isArray(ids) || ids.length === 0) {
		return { ok: false, message: "No transactions selected" };
	}

	const { data: existing, error: fetchError } = await supabase
		.from("transactions")
		.select("id, amount, occurred_on, payment_method, notes, payee, account_id, category_id, type, currency_code, updated_at")
		.eq("user_id", user.id)
		.is("deleted_at", null)
		.in("id", ids);

	if (fetchError) {
		throw fetchError;
	}

	const deletedAt = new Date().toISOString();
	const { error: deleteError } = await supabase
		.from("transactions")
		.update({ deleted_at: deletedAt, updated_at: deletedAt })
		.eq("user_id", user.id)
		.in("id", ids);

	if (deleteError) {
		throw deleteError;
	}

	if (existing?.length) {
		await supabase.from("audit_log").insert(
			existing.map((row) => ({
				user_id: user.id,
				table_name: "transactions",
				record_id: row.id,
				action: "delete" as const,
				snapshot: row as Json,
			})),
		);
	}

	revalidatePath("/");
	revalidatePath("/transactions");
	return { ok: true };
}

export async function bulkUpdateTransactionCategory(ids: string[], categoryId: string) {
	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not signed in");
	}
	if (!Array.isArray(ids) || ids.length === 0 || !categoryId) {
		return { ok: false, message: "Missing selection or category" };
	}

	const { error: categoryError, data: categoryRow } = await supabase
		.from("categories")
		.select("id")
		.eq("id", categoryId)
		.eq("user_id", user.id)
		.is("deleted_at", null)
		.maybeSingle();
	if (categoryError) {
		throw categoryError;
	}
	if (!categoryRow) {
		return { ok: false, message: "Invalid category" };
	}

	const { data: existing, error: fetchError } = await supabase
		.from("transactions")
		.select("id, amount, occurred_on, payment_method, notes, payee, account_id, category_id, type, currency_code, updated_at")
		.eq("user_id", user.id)
		.is("deleted_at", null)
		.in("id", ids);
	if (fetchError) throw fetchError;

	const { error: updateError } = await supabase
		.from("transactions")
		.update({ category_id: categoryId, updated_at: new Date().toISOString() })
		.eq("user_id", user.id)
		.in("id", ids);
	if (updateError) throw updateError;

	if (existing?.length) {
		await supabase.from("audit_log").insert(
			existing.map((row) => ({
				user_id: user.id,
				table_name: "transactions",
				record_id: row.id,
				action: "update" as const,
				snapshot: { ...row, category_id: categoryId } as Json,
			})),
		);
	}

	revalidatePath("/");
	revalidatePath("/transactions");
	return { ok: true };
}

export async function restoreTransaction(payload: {
	id: string;
	amount: number;
	occurred_on: string;
	payment_method: "cash" | "card" | "transfer" | "bank_transfer" | "account_transfer" | "other";
	notes: string | null;
	payee: string | null;
	account_id: string | null;
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

	const { data: existing, error: fetchError } = await supabase
		.from("transactions")
		.select("*")
		.eq("id", payload.id)
		.eq("user_id", user.id)
		.maybeSingle();

	if (fetchError) {
		throw fetchError;
	}

	const restoredAt = new Date().toISOString();
	const { error } = await supabase
		.from("transactions")
		.update({
			deleted_at: null,
			updated_at: restoredAt,
		})
		.eq("id", payload.id)
		.eq("user_id", user.id);

	if (error) {
		throw error;
	}

	await supabase.from("audit_log").insert({
		user_id: user.id,
		table_name: "transactions",
		record_id: payload.id,
		action: "restore",
		snapshot: existing as any,
	});

	revalidatePath("/");
	revalidatePath("/transactions");
}
