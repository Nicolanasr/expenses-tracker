import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export type Database = {
	public: {
		Tables: {
			budgets: {
				Row: {
					amount_cents: number;
					category_id: string;
					created_at: string;
					id: string;
					month: string;
					user_id: string;
				};
				Insert: {
					amount_cents: number;
					category_id: string;
					created_at?: string;
					id?: string;
					month: string;
					user_id: string;
				};
				Update: {
					amount_cents?: number;
					category_id?: string;
					created_at?: string;
					id?: string;
					month?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "budgets_category_id_fkey";
						columns: ["category_id"];
						referencedRelation: "categories";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "budgets_user_id_fkey";
						columns: ["user_id"];
						isOneToOne?: true;
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
				];
			};
			categories: {
				Row: {
					color: string | null;
					created_at: string;
					icon: string;
					id: string;
					name: string;
					type: "income" | "expense";
					user_id: string;
				};
				Insert: {
					color?: string | null;
					created_at?: string;
					icon?: string;
					id?: string;
					name: string;
					type: "income" | "expense";
					user_id: string;
				};
				Update: {
					color?: string | null;
					created_at?: string;
					icon?: string;
					id?: string;
					name?: string;
					type?: "income" | "expense";
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "categories_user_id_fkey";
						columns: ["user_id"];
						isOneToOne?: true;
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
				];
			};
			transactions: {
				Row: {
					amount: number;
					category_id: string | null;
					created_at: string;
					currency_code: string;
					id: string;
					notes: string | null;
					occurred_on: string;
					payment_method: "cash" | "card" | "transfer" | "other";
					type: "income" | "expense";
					user_id: string;
				};
				Insert: {
					amount: number;
					category_id?: string | null;
					created_at?: string;
					currency_code?: string;
					id?: string;
					notes?: string | null;
					occurred_on: string;
					payment_method: "cash" | "card" | "transfer" | "other";
					type: "income" | "expense";
					user_id: string;
				};
				Update: {
					amount?: number;
					category_id?: string | null;
					created_at?: string;
					currency_code?: string;
					id?: string;
					notes?: string | null;
					occurred_on?: string;
					payment_method?: "cash" | "card" | "transfer" | "other";
					type?: "income" | "expense";
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "transactions_category_id_fkey";
						columns: ["category_id"];
						referencedRelation: "categories";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "transactions_user_id_fkey";
						columns: ["user_id"];
						isOneToOne?: true;
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
				];
			};
			user_settings: {
				Row: {
					created_at: string;
					currency_code: string;
					display_name: string | null;
					pay_cycle_start_day: number;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					currency_code?: string;
					display_name?: string | null;
					pay_cycle_start_day?: number;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					currency_code?: string;
					display_name?: string | null;
					pay_cycle_start_day?: number;
					updated_at?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "user_settings_user_id_fkey";
						columns: ["user_id"];
						isOneToOne?: true;
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
				];
			};
		};
		Views: {
			monthly_totals: {
				Row: {
					user_id: string | null;
					month: string | null;
					total_amount: number | null;
					type: "income" | "expense" | null;
				};
				Relationships: [];
			};
			v_budget_summary: {
				Row: {
					budget_cents: number | null;
					category_id: string | null;
					month: string | null;
					spent_cents: number | null;
					user_id: string | null;
				};
				Relationships: [];
			};
		};
		Functions: {
			rpc_copy_budgets: {
				Args: {
					p_from_month: string;
					p_to_month: string;
				};
				Returns: number;
			};
			rpc_get_budget_summary: {
				Args: {
					p_month: string;
				};
				Returns: {
					category_id: string;
					budget_cents: number;
					spent_cents: number;
					remaining_cents: number;
					used_pct: number;
				}[];
			};
		};
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
};

function requireEnv(key: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing environment variable: ${key}`);
	}
	return value;
}

export function createSupabaseServerComponentClient() {
	const cookieStore = cookies();

	return createServerClient<Database>(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
		cookies: {
			async getAll() {
				return (await cookieStore).getAll();
			},
			// server components can't mutate cookies; no-op is fine
			setAll() {
				/* no-op */
			},
		},
	});
}

export function createSupabaseServerActionClient(): SupabaseClient<Database> {
	const store = cookies();
	return createServerClient<Database>(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
		cookies: {
			getAll: async () => (await store).getAll(),
			setAll: (toSet) => toSet.forEach(async (c) => (await store).set(c.name, c.value, c.options)),
		},
	});
}
