"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerActionClient } from "@/lib/supabase/server";

const markSchema = z.object({ notification_id: z.string().uuid() });

export async function markNotificationReadAction(formData: FormData) {
	const parsed = markSchema.safeParse({ notification_id: formData.get("notification_id") });
	if (!parsed.success) {
		return;
	}

	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();

	if (error || !user) {
		return;
	}

	await supabase
		.from("notifications")
		.update({ status: "read", read_at: new Date().toISOString() })
		.eq("id", parsed.data.notification_id)
		.eq("user_id", user.id);

	revalidatePath("/transactions");
}

export async function markAllNotificationsReadAction() {
	const supabase = await createSupabaseServerActionClient();
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();

	if (error || !user) {
		return;
	}

	await supabase
		.from("notifications")
		.update({ status: "read", read_at: new Date().toISOString() })
		.eq("user_id", user.id)
		.eq("status", "unread");

	revalidatePath("/transactions");
}
