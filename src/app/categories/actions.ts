"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerActionClient } from "@/lib/supabase/server";

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
	});

	if (!payload.success) {
		return {
			ok: false,
			errors: payload.error.flatten().fieldErrors,
		};
	}

	const { error } = await supabase
		.from("categories")
		.update({
			name: payload.data.name.trim(),
			icon: payload.data.icon,
			color: payload.data.color,
		})
		.eq("id", payload.data.id)
		.eq("user_id", user.id);

	if (error) {
		console.error(error);
		return {
			ok: false,
			error: "Unable to update category, try again.",
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

	const { error } = await supabase.from("categories").delete().eq("id", payload.data.id).eq("user_id", user.id);

	if (error) {
		console.error(error);
		return {
			ok: false,
			error: "Unable to delete category.",
		};
	}

	revalidatePath("/categories");
	revalidatePath("/");
	revalidatePath("/transactions");

	return { ok: true };
}
