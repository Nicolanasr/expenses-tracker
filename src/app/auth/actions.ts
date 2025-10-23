"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerActionClient } from "@/lib/supabase/server";

type FormErrors = Record<string, string[] | undefined>;

export type AuthFormState = {
	ok: boolean;
	errors?: FormErrors;
	message?: string;
};

const EMPTY_STATE: AuthFormState = { ok: false, errors: {} };

const credentialsSchema = z.object({
	email: z.string({ required_error: "Email is required" }).email("Enter a valid email"),
	password: z.string({ required_error: "Password is required" }).min(6, "Use at least 6 characters"),
});

export async function signIn(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
	const result = credentialsSchema.safeParse({
		email: formData.get("email"),
		password: formData.get("password"),
	});

	if (!result.success) {
		return {
			...EMPTY_STATE,
			errors: result.error.flatten().fieldErrors,
		};
	}

	const supabase = await createSupabaseServerActionClient();
	const { error } = await supabase.auth.signInWithPassword({
		email: result.data.email,
		password: result.data.password,
	});

	if (error) {
		return {
			ok: false,
			message: error.message,
		};
	}

	revalidatePath("/");
	revalidatePath("/transactions");
	revalidatePath("/categories");
	redirect("/");
}

export async function signUp(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
	const result = credentialsSchema.safeParse({
		email: formData.get("email"),
		password: formData.get("password"),
	});

	if (!result.success) {
		return {
			...EMPTY_STATE,
			errors: result.error.flatten().fieldErrors,
		};
	}

	const supabase = await createSupabaseServerActionClient();
	const { error } = await supabase.auth.signUp({
		email: result.data.email,
		password: result.data.password,
	});

	if (error) {
		return {
			ok: false,
			message: error.message,
		};
	}

	revalidatePath("/");
	redirect("/");
}

export async function signOut() {
	const supabase = await createSupabaseServerActionClient();
	await supabase.auth.signOut();

	revalidatePath("/");
	revalidatePath("/transactions");
	revalidatePath("/categories");
	redirect("/auth/sign-in");
}
