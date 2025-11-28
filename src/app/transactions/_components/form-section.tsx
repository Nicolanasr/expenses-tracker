"use server";

import { CreateTransactionForm } from "@/app/_components/create-transaction-form";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

type Props = {
	userId: string;
};

export async function FormSection({ userId }: Props) {
	const supabase = await createSupabaseServerComponentClient();
	const [{ data: categoryRows }, { data: accountRows }, { data: payeeRows }] = await Promise.all([
		supabase.from("categories").select("id, name, type, icon, color").eq("user_id", userId).is("deleted_at", null).order("name", { ascending: true }),
		supabase.from("accounts").select("id, name, type, institution, default_payment_method").eq("user_id", userId).is("deleted_at", null).order("name", { ascending: true }),
		supabase.from("transactions").select("payee").eq("user_id", userId).not("payee", "is", null).limit(50),
	]);

	const categories = (categoryRows ?? []).map((c) => ({
		id: c.id,
		name: c.name,
		type: c.type as "income" | "expense",
		icon: c.icon,
		color: c.color,
	}));

	const accounts = (accountRows ?? []).map((a) => ({
		id: a.id,
		name: a.name,
		type: a.type,
		institution: a.institution,
		defaultPaymentMethod: a.default_payment_method,
	}));

	const payees = Array.from(new Set((payeeRows ?? []).map((p) => p.payee).filter(Boolean))) as string[];

	return <CreateTransactionForm categories={categories} accounts={accounts} payees={payees} />;
}
