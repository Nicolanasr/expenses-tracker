import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	public: {
		Tables: {
			accounts: {
				Row: {
					id: string;
					user_id: string;
					name: string;
					type: "cash" | "checking" | "savings" | "credit" | "investment" | "other";
					institution: string | null;
					color: string | null;
					starting_balance: number;
					default_payment_method: "cash" | "card" | "transfer" | "bank_transfer" | "account_transfer" | "other" | null;
					currency_code: string;
					created_at: string;
					updated_at: string;
					deleted_at: string | null;
				};
				Insert: {
					id?: string;
					user_id: string;
					name: string;
					type?: "cash" | "checking" | "savings" | "credit" | "investment" | "other";
					institution?: string | null;
					color?: string | null;
					starting_balance?: number;
					default_payment_method?: "cash" | "card" | "transfer" | "bank_transfer" | "account_transfer" | "other" | null;
					currency_code?: string;
					created_at?: string;
					updated_at?: string;
					deleted_at?: string | null;
				};
				Update: {
					id?: string;
					user_id?: string;
					name?: string;
					type?: "cash" | "checking" | "savings" | "credit" | "investment" | "other";
					institution?: string | null;
					color?: string | null;
					starting_balance?: number;
					default_payment_method?: "cash" | "card" | "transfer" | "bank_transfer" | "account_transfer" | "other" | null;
					currency_code?: string;
					created_at?: string;
					updated_at?: string;
					deleted_at?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "accounts_user_id_fkey";
						columns: ["user_id"];
						referencedRelation: "users";
						referencedColumns: ["id"];
					}
				];
			};
			budgets: {
				Row: {
					label: string;
					amount_cents: number;
					category_id: string;
					currency_code: string;
					account_id: string | null;
					account_ids?: string[] | null;
					created_at: string;
					id: string;
					month: string;
					user_id: string;
					updated_at: string;
					deleted_at: string | null;
				};
				Insert: {
					label?: string;
					amount_cents: number;
					category_id: string;
					currency_code?: string;
					account_id?: string | null;
					account_ids?: string[] | null;
					created_at?: string;
					id?: string;
					month: string;
					user_id: string;
					updated_at?: string;
					deleted_at?: string | null;
				};
				Update: {
					label?: string;
					amount_cents?: number;
					category_id?: string;
					currency_code?: string;
					account_id?: string | null;
					account_ids?: string[] | null;
					created_at?: string;
					id?: string;
					month?: string;
					user_id?: string;
					updated_at?: string;
					deleted_at?: string | null;
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
					}
				];
			};
			budget_accounts: {
				Row: {
					budget_id: string;
					account_id: string;
				};
				Insert: {
					budget_id: string;
					account_id: string;
				};
				Update: {
					budget_id?: string;
					account_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "budget_accounts_budget_id_fkey";
						columns: ["budget_id"];
						referencedRelation: "budgets";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "budget_accounts_account_id_fkey";
						columns: ["account_id"];
						referencedRelation: "accounts";
						referencedColumns: ["id"];
					}
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
					updated_at: string;
					deleted_at: string | null;
				};
				Insert: {
					color?: string | null;
					created_at?: string;
					icon?: string;
					id?: string;
					name: string;
					type: "income" | "expense";
					user_id: string;
					updated_at?: string;
					deleted_at?: string | null;
				};
				Update: {
					color?: string | null;
					created_at?: string;
					icon?: string;
					id?: string;
					name?: string;
					type?: "income" | "expense";
					user_id?: string;
					updated_at?: string;
					deleted_at?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "categories_user_id_fkey";
						columns: ["user_id"];
						isOneToOne?: true;
						referencedRelation: "users";
						referencedColumns: ["id"];
					}
				];
			};
			transactions: {
				Row: {
					amount: number;
					account_id: string | null;
					recurring_transaction_id: string | null;
					category_id: string | null;
					created_at: string;
					currency_code: string;
					deleted_at: string | null;
					id: string;
					payee: string | null;
					notes: string | null;
					occurred_on: string;
					payment_method: "cash" | "card" | "transfer" | "bank_transfer" | "account_transfer" | "other";
					type: "income" | "expense";
					user_id: string;
					updated_at: string;
				};
				Insert: {
					amount: number;
					account_id?: string | null;
					recurring_transaction_id?: string | null;
					category_id?: string | null;
					created_at?: string;
					currency_code?: string;
					deleted_at?: string | null;
					id?: string;
					payee?: string | null;
					notes?: string | null;
					occurred_on: string;
					payment_method: "cash" | "card" | "transfer" | "bank_transfer" | "account_transfer" | "other";
					type: "income" | "expense";
					user_id: string;
					updated_at?: string;
				};
				Update: {
					amount?: number;
					account_id?: string | null;
					recurring_transaction_id?: string | null;
					category_id?: string | null;
					created_at?: string;
					currency_code?: string;
					deleted_at?: string | null;
					id?: string;
					payee?: string | null;
					notes?: string | null;
					occurred_on?: string;
					payment_method?: "cash" | "card" | "transfer" | "bank_transfer" | "account_transfer" | "other";
					type?: "income" | "expense";
					user_id?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "transactions_category_id_fkey";
						columns: ["category_id"];
						referencedRelation: "categories";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "transactions_account_id_fkey";
						columns: ["account_id"];
						referencedRelation: "accounts";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "transactions_user_id_fkey";
						columns: ["user_id"];
						isOneToOne?: true;
						referencedRelation: "users";
						referencedColumns: ["id"];
					}
				];
			};
			recurring_transactions: {
				Row: {
					id: string;
					user_id: string;
					name: string;
					amount: number;
					type: "income" | "expense";
					category_id: string | null;
					account_id: string | null;
					payment_method: "cash" | "card" | "transfer" | "bank_transfer" | "account_transfer" | "other";
					notes: string | null;
					auto_log: boolean;
					frequency: "daily" | "weekly" | "monthly" | "yearly";
					next_run_on: string;
					created_at: string;
					updated_at: string;
					deleted_at: string | null;
				};
				Insert: {
					id?: string;
					user_id: string;
					name: string;
					amount: number;
					type: "income" | "expense";
					category_id?: string | null;
					account_id?: string | null;
					payment_method: "cash" | "card" | "transfer" | "bank_transfer" | "account_transfer" | "other";
					notes?: string | null;
					auto_log?: boolean;
					frequency: "daily" | "weekly" | "monthly" | "yearly";
					next_run_on: string;
					created_at?: string;
					updated_at?: string;
					deleted_at?: string | null;
				};
				Update: {
					id?: string;
					user_id?: string;
					name?: string;
					amount?: number;
					type?: "income" | "expense";
					category_id?: string | null;
					account_id?: string | null;
					payment_method?: "cash" | "card" | "transfer" | "bank_transfer" | "account_transfer" | "other";
					notes?: string | null;
					auto_log?: boolean;
					frequency?: "daily" | "weekly" | "monthly" | "yearly";
					next_run_on?: string;
					created_at?: string;
					updated_at?: string;
					deleted_at?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "recurring_transactions_account_id_fkey";
						columns: ["account_id"];
						referencedRelation: "accounts";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "recurring_transactions_category_id_fkey";
						columns: ["category_id"];
						referencedRelation: "categories";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "recurring_transactions_user_id_fkey";
						columns: ["user_id"];
						referencedRelation: "users";
						referencedColumns: ["id"];
					}
				];
			};
			notifications: {
				Row: {
					id: string;
					user_id: string;
					title: string;
					body: string | null;
					type: "recurring_due" | "recurring_logged" | "budget_threshold";
					status: "unread" | "read";
					reference_id: string | null;
					metadata: Json | null;
					created_at: string;
					read_at: string | null;
				};
				Insert: {
					id?: string;
					user_id: string;
					title: string;
					body?: string | null;
					type: "recurring_due" | "recurring_logged" | "budget_threshold";
					status?: "unread" | "read";
					reference_id?: string | null;
					metadata?: Json | null;
					created_at?: string;
					read_at?: string | null;
				};
				Update: {
					id?: string;
					user_id?: string;
					title?: string;
					body?: string | null;
					type?: "recurring_due" | "recurring_logged" | "budget_threshold";
					status?: "unread" | "read";
					reference_id?: string | null;
					metadata?: Json | null;
					created_at?: string;
					read_at?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "notifications_user_id_fkey";
						columns: ["user_id"];
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "notifications_reference_id_fkey";
						columns: ["reference_id"];
						referencedRelation: "recurring_transactions";
						referencedColumns: ["id"];
					}
				];
			};
			audit_log: {
				Row: {
					id: string;
					user_id: string;
					table_name: string;
					record_id: string;
					action: "create" | "update" | "delete" | "restore";
					snapshot: Json | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					table_name: string;
					record_id: string;
					action: "create" | "update" | "delete" | "restore";
					snapshot?: Json | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					table_name?: string;
					record_id?: string;
					action?: "create" | "update" | "delete" | "restore";
					snapshot?: Json | null;
					created_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "audit_log_user_id_fkey";
						columns: ["user_id"];
						referencedRelation: "users";
						referencedColumns: ["id"];
					}
				];
			};
			user_settings: {
				Row: {
					created_at: string;
					currency_code: string;
					display_name: string | null;
					pay_cycle_start_day: number;
					saved_filters: Json;
					budget_thresholds: Json;
					updated_at: string;
					user_id: string;
				};
				Insert: {
					created_at?: string;
					currency_code?: string;
					display_name?: string | null;
					pay_cycle_start_day?: number;
					saved_filters?: Json;
					budget_thresholds?: Json;
					updated_at?: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					currency_code?: string;
					display_name?: string | null;
					pay_cycle_start_day?: number;
					saved_filters?: Json;
					budget_thresholds?: Json;
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
					}
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
