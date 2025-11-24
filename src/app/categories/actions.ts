"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerActionClient, type Json } from "@/lib/supabase/server";

export type FormState = {
	ok: boolean;
	error?: string;
	errors?: Record<string, string[] | undefined>;
};

const updateCategorySchema = z.object({
	id: z.string().uuid("Invalid category id"),
	name: z
		.string({ error: "Category name is required" })
		.min(2, "Category name should be at least 2 characters")
		.max(40, "Category name should be less than 40 characters"),
	icon: z
		.string({ error: "Icon is required" })
		.min(1, "Pick an emoji to help recognise the category")
		.max(4, "Keep the icon short (use a single emoji)"),
	color: z.string({ error: "Pick a colour" }).regex(/^#([0-9a-f]{3}){1,2}$/i, "Provide a valid hex colour"),
	updated_at: z.string().optional(),
});

const deleteCategorySchema = z.object({
	id: z.string().uuid("Invalid category id"),
});

export async function updateCategory(_prevState: FormState, formData: FormData): Promise<FormState> {
	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		return {
			ok: false,
			error: "You must be signed in to update categories.",
		};
	}

	const payload = updateCategorySchema.safeParse({
		id: formData.get("id"),
		name: formData.get("name"),
		icon: formData.get("icon"),
		color: formData.get("color"),
		updated_at: formData.get("updated_at"),
	});

	if (!payload.success) {
		return {
			ok: false,
			errors: payload.error.flatten().fieldErrors,
		};
	}

	let query = supabase
		.from("categories")
		.update({
			name: payload.data.name.trim(),
			icon: payload.data.icon,
			color: payload.data.color,
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
			error: "Unable to update category, try again.",
		};
	}

	if (!updated) {
		return {
			ok: false,
			error: "This category changed elsewhere. Refresh and try again.",
		};
	}

	revalidatePath("/categories");
	revalidatePath("/");
	revalidatePath("/transactions");
	return { ok: true };
}

export async function deleteCategory(prevState: FormState, formData: FormData): Promise<FormState> {
	const payload = deleteCategorySchema.safeParse({
		id: formData.get("id"),
	});

	if (!payload.success) {
		return {
			ok: false,
			error: payload.error.flatten().formErrors.join(", "),
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
			error: "You must be signed in to delete categories.",
		};
	}

	const { data: existing, error: fetchError } = await supabase
		.from("categories")
		.select("*")
		.eq("id", payload.data.id)
		.eq("user_id", user.id)
		.is("deleted_at", null)
		.maybeSingle();

	if (fetchError) {
		console.error(fetchError);
		return { ok: false, error: "Unable to delete category." };
	}

	if (existing) {
		const deletedAt = new Date().toISOString();
		const { error } = await supabase
			.from("categories")
			.update({ deleted_at: deletedAt, updated_at: deletedAt })
			.eq("id", payload.data.id)
			.eq("user_id", user.id);

		if (error) {
			console.error(error);
			return { ok: false, error: "Unable to delete category." };
		}

		await supabase.from("audit_log").insert({
			user_id: user.id,
			table_name: "categories",
			record_id: payload.data.id,
			action: "delete",
			snapshot: existing as unknown as Json,
		});
	}

	revalidatePath("/categories");
	revalidatePath("/");
	revalidatePath("/transactions");

	return { ok: true };
}

export async function deleteCategoryById(id: string, version?: string) {
	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		throw userError ?? new Error("You must be signed in to delete categories.");
	}

	const { data: existing, error: fetchError } = await supabase
		.from("categories")
		.select("id, name, icon, color, type, updated_at")
		.eq("id", id)
		.eq("user_id", user.id)
		.is("deleted_at", null)
		.maybeSingle();

	if (fetchError) {
		throw fetchError;
	}

	if (!existing) {
		throw new Error("Category not found or already changed.");
	}

	if (version && existing.updated_at !== version) {
		throw new Error("Category was updated elsewhere.");
	}

	const deletedAt = new Date().toISOString();
	const { error } = await supabase
		.from("categories")
		.update({ deleted_at: deletedAt, updated_at: deletedAt })
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) {
		throw error;
	}

	await supabase.from("audit_log").insert({
		user_id: user.id,
		table_name: "categories",
		record_id: id,
		action: "delete",
		snapshot: existing as unknown as Json,
	});

	revalidatePath("/categories");
	revalidatePath("/");
	revalidatePath("/transactions");

	return existing;
}

export async function restoreCategory(category: { id: string; name: string; icon: string | null; color: string | null; type: "income" | "expense" }) {
	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		throw userError ?? new Error("You must be signed in to restore categories.");
	}

	const restoredAt = new Date().toISOString();
	const { error } = await supabase
		.from("categories")
		.update({
			deleted_at: null,
			updated_at: restoredAt,
		})
		.eq("id", category.id)
		.eq("user_id", user.id);

	if (error) {
		throw error;
	}

	await supabase.from("audit_log").insert({
		user_id: user.id,
		table_name: "categories",
		record_id: category.id,
		action: "restore",
		snapshot: category as unknown as Json,
	});

	revalidatePath("/categories");
	revalidatePath("/");
	revalidatePath("/transactions");
}
