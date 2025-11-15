"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerActionClient } from "@/lib/supabase/server";

const saveFilterSchema = z.object({
	name: z
		.string()
		.min(2, "Give your preset a short name")
		.max(32, "Keep names under 32 characters"),
	query: z.string().min(1, "Nothing to save yet"),
});

const deleteFilterSchema = z.object({
	id: z.string().uuid(),
});

type SavedFilter = {
	id: string;
	name: string;
	query: string;
};

function sanitizeSavedFilters(value: unknown): SavedFilter[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			if (!item || typeof item !== "object") return null;
			const record = item as Record<string, unknown>;
			if (typeof record.id !== "string" || typeof record.name !== "string" || typeof record.query !== "string") {
				return null;
			}
			return {
				id: record.id,
				name: record.name,
				query: record.query,
			};
		})
		.filter((item): item is SavedFilter => Boolean(item));
}

export async function saveDashboardFilter(payload: { name: string; query: string }) {
	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		throw new Error("Sign in to save filter presets.");
	}

	const parsed = saveFilterSchema.parse({
		name: payload.name.trim(),
		query: payload.query.trim(),
	});

	const { data } = await supabase
		.from("user_settings")
		.select("saved_filters")
		.eq("user_id", user.id)
		.maybeSingle();

	const existing = sanitizeSavedFilters(data?.saved_filters);
	const nextFilters: SavedFilter[] = [{ id: crypto.randomUUID(), name: parsed.name, query: parsed.query }, ...existing].slice(
		0,
		2,
	);

	const { error } = await supabase
		.from("user_settings")
		.upsert(
			{
				user_id: user.id,
				saved_filters: nextFilters,
			},
			{ onConflict: "user_id" },
		);

	if (error) {
		throw error;
	}

	revalidatePath("/");
	revalidatePath("/transactions");
}

export async function deleteDashboardFilter(payload: { id: string }) {
	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		throw new Error("Sign in to update presets.");
	}

	const parsed = deleteFilterSchema.parse(payload);

	const { data } = await supabase
		.from("user_settings")
		.select("saved_filters")
		.eq("user_id", user.id)
		.maybeSingle();

	const existing = sanitizeSavedFilters(data?.saved_filters);
	const nextFilters = existing.filter((filter) => filter.id !== parsed.id);

	const { error } = await supabase
		.from("user_settings")
		.upsert(
			{
				user_id: user.id,
				saved_filters: nextFilters,
			},
			{ onConflict: "user_id" },
		);

	if (error) {
		throw error;
	}

	revalidatePath("/");
	revalidatePath("/transactions");
}
