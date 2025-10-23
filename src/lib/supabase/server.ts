import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export type Database = {
	public: {
		Tables: {
			categories: {
				Row: {
					id: string;
					name: string;
					type: "income" | "expense";
					icon: string;
					user_id: string;
					color: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					type: "income" | "expense";
					icon?: string;
					user_id: string;
					color?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					name?: string;
					type?: "income" | "expense";
					icon?: string;
					user_id?: string;
					color?: string | null;
					created_at?: string;
				};
				Relationships: [];
			};
			transactions: {
				Row: {
					id: string;
					amount: number;
					type: "income" | "expense";
					category_id: string | null;
					user_id: string;
					occurred_on: string;
					payment_method: "cash" | "card" | "transfer" | "other";
					notes: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					amount: number;
					type: "income" | "expense";
					category_id: string | null;
					user_id: string;
					occurred_on: string;
					payment_method: "cash" | "card" | "transfer" | "other";
					notes?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					amount?: number;
					type?: "income" | "expense";
					category_id?: string | null;
					user_id?: string;
					occurred_on?: string;
					payment_method?: "cash" | "card" | "transfer" | "other";
					notes?: string | null;
					created_at?: string;
				};
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: Record<string, never>;
	};
};

function requireEnv(key: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing environment variable: ${key}`);
	}
	return value;
}

export async function createSupabaseServerComponentClient() {
	const cookieStore = await cookies();

	return createServerClient<Database>(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
		cookies: {
			get(name: string) {
				return cookieStore.get(name)?.value;
			},
			set() {
				// No-op: server components cannot mutate cookies.
			},
			remove() {
				// No-op: server components cannot mutate cookies.
			},
		},
	});
}

export async function createSupabaseServerActionClient() {
	const cookieStore = await cookies();
	const mutable = cookieStore as unknown as {
		get?: (name: string) => { value: string } | undefined;
		set?: (name: string, value: string, options?: CookieOptions) => void;
		delete?: (name: string, options?: CookieOptions) => void;
	};

	return createServerClient<Database>(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
		cookies: {
			get(name: string) {
				return mutable.get ? mutable.get(name)?.value : undefined;
			},
			set(name: string, value: string, options: CookieOptions) {
				if (!mutable.set) {
					return;
				}
				try {
					mutable.set(name, value, options);
				} catch {
					// ignore read-only errors
				}
			},
			remove(name: string, options: CookieOptions) {
				if (mutable.delete) {
					try {
						mutable.delete(name, options);
						return;
					} catch {
						// ignore read-only errors
					}
				}
				if (mutable.set) {
					try {
						mutable.set(name, "", { ...options, expires: new Date(0) });
					} catch {
						// ignore read-only errors
					}
				}
			},
		},
	});
}
