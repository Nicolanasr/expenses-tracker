"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { CURRENCY_LOCK_MESSAGE, settingsSchema, type SettingsFormState } from "@/app/account/_lib/settings-form";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";

export async function updateUserSettings(_prevState: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		return { ok: false, message: "You must be signed in." };
	}

	const payload = settingsSchema.safeParse({
		currency_code: String(formData.get("currency_code") ?? ""),
		display_name: formData.get("display_name")?.toString().trim() || null,
		pay_cycle_start_day: formData.get("pay_cycle_start_day") ?? "1",
	});

	if (!payload.success) {
		return {
			ok: false,
			errors: payload.error.flatten().fieldErrors,
		};
	}

	const { data: existingSettings, error: settingsError } = await supabase.from("user_settings").select("currency_code").eq("user_id", user.id).maybeSingle();

	if (settingsError && settingsError.code !== "PGRST116") {
		console.error(settingsError);
		return { ok: false, message: "Unable to update settings, try again." };
	}

	const { count: transactionsCount, error: transactionsError } = await supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", user.id);

	if (transactionsError) {
		console.error(transactionsError);
		return { ok: false, message: "Unable to update settings, try again." };
	}

	const hasTransactions = (transactionsCount ?? 0) > 0;
	const existingCurrency = existingSettings?.currency_code;
	const currencyChanged = existingCurrency ? existingCurrency !== payload.data.currency_code : false;

	if (hasTransactions && currencyChanged) {
		return {
			ok: false,
			message: CURRENCY_LOCK_MESSAGE,
			errors: { currency_code: [CURRENCY_LOCK_MESSAGE] },
		};
	}

	const { error } = await supabase.from("user_settings").upsert(
		{
			user_id: user.id,
			currency_code: payload.data.currency_code,
			display_name: payload.data.display_name,
			pay_cycle_start_day: payload.data.pay_cycle_start_day,
		},
		{ onConflict: "user_id" }
	);

	if (error) {
		console.error(error);
		return { ok: false, message: "Unable to update settings, try again." };
	}

	revalidatePath("/");
	revalidatePath("/transactions");
	revalidatePath("/budgets");
	return { ok: true, message: "Settings saved." };
}

const accountSchema = z.object({
	name: z
		.string({ error: "Account name is required" })
		.min(2, "Name is too short")
		.max(48, "Keep the name under 48 characters"),
	type: z.enum(["cash", "checking", "savings", "credit", "investment", "other"]),
	institution: z
		.string()
		.max(80, "Institution name is too long")
		.optional()
		.or(z.literal(""))
		.transform((val) => (val ? val : null)),
	starting_balance: z
		.string()
		.optional()
		.transform((val) => {
			if (!val) return 0;
			const parsed = Number(val);
			return Number.isNaN(parsed) ? 0 : parsed;
		}),
	default_payment_method: z
		.enum(["cash", "card", "transfer", "bank_transfer", "other"])
		.optional()
		.or(z.literal(""))
		.transform((val) => (val ? val : null)),
});

export type AccountFormState = {
	ok: boolean;
	errors?: Record<string, string[] | undefined>;
	message?: string;
};

export async function createAccountAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		return { ok: false, message: "You must be signed in." };
	}

	const payload = accountSchema.safeParse({
		name: formData.get("name"),
		type: (formData.get("type") ?? "cash").toString() as "cash",
		institution: formData.get("institution"),
		starting_balance: formData.get("starting_balance"),
		default_payment_method: formData.get("default_payment_method"),
	});

	if (!payload.success) {
		return {
			ok: false,
			errors: payload.error.flatten().fieldErrors,
		};
	}

	const { error } = await supabase.from("accounts").insert({
		name: payload.data.name.trim(),
		type: payload.data.type,
		institution: payload.data.institution,
		starting_balance: payload.data.starting_balance,
		default_payment_method: payload.data.default_payment_method,
		user_id: user.id,
	});

	if (error) {
		const message = error.code === "23505" ? "Account name already exists." : "Unable to save account.";
		return {
			ok: false,
			message,
			errors: { name: [message] },
		};
	}

	revalidatePath("/account");
	revalidatePath("/");
	return { ok: true, message: "Account added." };
}

export async function deleteAccountAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
	const accountId = formData.get("account_id")?.toString();
	if (!accountId) {
		return { ok: false, message: "Missing account id." };
	}

	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		return { ok: false, message: "You must be signed in." };
	}

	const { data: existing, error: fetchError } = await supabase
		.from("accounts")
		.select("*")
		.eq("id", accountId)
		.eq("user_id", user.id)
		.is("deleted_at", null)
		.maybeSingle();

	if (fetchError) {
		console.error(fetchError);
		return { ok: false, message: "Unable to delete account. Remove linked transactions first." };
	}

	if (existing) {
		const deletedAt = new Date().toISOString();
		const { error } = await supabase
			.from("accounts")
			.update({ deleted_at: deletedAt, updated_at: deletedAt })
			.eq("id", accountId)
			.eq("user_id", user.id);
		if (error) {
			return { ok: false, message: "Unable to delete account. Remove linked transactions first." };
		}
		await supabase.from("audit_log").insert({
			user_id: user.id,
			table_name: "accounts",
			record_id: accountId,
			action: "delete",
			snapshot: existing as unknown as Record<string, unknown>,
		});
	}

	revalidatePath("/account");
	revalidatePath("/");
	revalidatePath("/transactions");
	return { ok: true, message: "Account deleted." };
}

export async function updateAccountAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		return { ok: false, message: "You must be signed in." };
	}

	const accountId = formData.get("account_id")?.toString();
	if (!accountId) {
		return { ok: false, message: "Missing account id." };
	}

	const payload = accountSchema.safeParse({
		name: formData.get("name"),
		type: (formData.get("type") ?? "cash").toString(),
		institution: formData.get("institution"),
		starting_balance: formData.get("starting_balance"),
		default_payment_method: formData.get("default_payment_method"),
	});

	if (!payload.success) {
		return {
			ok: false,
			errors: payload.error.flatten().fieldErrors,
		};
	}

	const { error } = await supabase
		.from("accounts")
		.update({
			name: payload.data.name.trim(),
			type: payload.data.type,
			institution: payload.data.institution,
			starting_balance: payload.data.starting_balance,
			default_payment_method: payload.data.default_payment_method,
		})
		.eq("id", accountId)
		.eq("user_id", user.id);

	if (error) {
		const message = error.code === "23505" ? "Account name already exists." : "Unable to update account.";
		return { ok: false, message, errors: { name: [message] } };
	}

	revalidatePath("/account");
	revalidatePath("/");
	revalidatePath("/transactions");
	return { ok: true, message: "Account updated." };
}
