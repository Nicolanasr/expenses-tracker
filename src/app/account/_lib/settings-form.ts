import { z } from "zod";

export const CURRENCY_LOCK_MESSAGE = "Currency can't be changed after you've recorded transactions. Multi-currency support is coming soon.";

export const settingsSchema = z.object({
	currency_code: z.string({ error: "Currency is required" }).length(3, "Use a valid ISO currency code"),
	display_name: z.string().max(60, "Display name should be shorter than 60 characters").optional().nullable(),
});

export type SettingsFormState = {
	ok: boolean;
	message?: string;
	errors?: Record<string, string[] | undefined>;
};

export const SETTINGS_INITIAL_STATE: SettingsFormState = { ok: false };
