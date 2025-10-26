"use server";

import { revalidatePath } from "next/cache";

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
