import { NextResponse } from "next/server";

import { createSupabaseServerActionClient } from "@/lib/supabase/server";

export async function GET() {
	try {
		const supabase = await createSupabaseServerActionClient();
		const {
			data: { user },
			error,
		} = await supabase.auth.getUser();

		if (error || !user) {
			return NextResponse.json({ notifications: [] }, { status: 200 });
		}

		const { data, error: notificationsError } = await supabase
			.from("notifications")
			.select("id, title, body, type, status, created_at, metadata")
			.eq("user_id", user.id)
			.order("created_at", { ascending: false })
			.limit(20);

		if (notificationsError) {
			throw notificationsError;
		}

		return NextResponse.json({ notifications: data ?? [] });
	} catch (error) {
		console.error("[notifications-api]", error);
		return NextResponse.json({ notifications: [] }, { status: 200 });
	}
}
