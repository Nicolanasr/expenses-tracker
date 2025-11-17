import { NextResponse } from "next/server";

import { createCategory, createTransaction, deleteTransactionById, updateTransaction, type FormState as TransactionFormState } from "@/app/actions";
import { deleteCategoryById, updateCategory, type FormState as CategoryFormState } from "@/app/categories/actions";
import { saveBudgetsAction } from "@/app/budgets/actions";

type TxPayload = Record<string, unknown>;
type CategoryPayload = Record<string, unknown>;
type BudgetPayload = { month: string; items: Array<{ categoryId: string; amount: number }> };

type Mutation =
	| { type: "transaction:create"; data: TxPayload }
	| { type: "transaction:update"; data: TxPayload }
	| { type: "transaction:delete"; data: TxPayload }
	| { type: "category:create"; data: CategoryPayload }
	| { type: "category:update"; data: CategoryPayload }
	| { type: "category:delete"; data: CategoryPayload }
	| { type: "budget:save"; data: BudgetPayload };

function toFormData(data: Record<string, unknown>) {
	const form = new FormData();
	Object.entries(data ?? {}).forEach(([key, value]) => {
		if (value === undefined || value === null) return;
		form.append(key, String(value));
	});
	return form;
}

export async function POST(request: Request) {
	try {
		const payload: Mutation = await request.json();
		if (!payload || !payload.type) {
			throw new Error("Invalid payload");
		}

		switch (payload.type) {
			case "transaction:create": {
				const form = toFormData(payload.data ?? {});
				const result = await createTransaction(null, form);
				if (!result?.ok) {
					throw new Error(Object.values(result?.errors ?? {})[0]?.[0] ?? "Unable to create transaction");
				}
				break;
			}
			case "transaction:update": {
				if (!payload.data?.updated_at) {
					throw new Error("Missing version for transaction update");
				}
				const form = toFormData(payload.data ?? {});
				const result = await updateTransaction({ ok: false } as TransactionFormState, form);
				if (!result?.ok) {
					throw new Error(Object.values(result?.errors ?? {})[0]?.[0] ?? "Unable to update transaction");
				}
				break;
			}
			case "transaction:delete": {
				const id = payload.data?.id as string | undefined;
				if (!id) throw new Error("Missing id");
				if (!payload.data?.updated_at) throw new Error("Missing version for delete");
				await deleteTransactionById(id, payload.data.updated_at as string);
				break;
			}
			case "category:create": {
				const result = await createCategory(null, toFormData(payload.data ?? {}));
				if (!result?.ok) {
					throw new Error(Object.values(result?.errors ?? {})[0]?.[0] ?? result?.errors ?? "Unable to create category");
				}
				break;
			}
			case "category:update": {
				if (!payload.data?.updated_at) {
					throw new Error("Missing version for category update");
				}
				const result = await updateCategory({ ok: false } as CategoryFormState, toFormData(payload.data ?? {}));
				if (!result?.ok) {
					throw new Error(Object.values(result?.errors ?? {})[0]?.[0] ?? result?.error ?? "Unable to update category");
				}
				break;
			}
			case "category:delete": {
				const id = payload.data?.id as string | undefined;
				if (!id) throw new Error("Missing id");
				if (!payload.data?.updated_at) throw new Error("Missing version for delete");
				await deleteCategoryById(id, payload.data.updated_at as string);
				break;
			}
			case "budget:save": {
				const form = new FormData();
				form.append("payload", JSON.stringify(payload.data));
				await saveBudgetsAction(form);
				break;
			}
			default:
				throw new Error("Unknown mutation type");
		}

		return NextResponse.json({ ok: true });
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: typeof error === "string"
					? error
					: JSON.stringify(error);
		console.error("[transactions/mutate]", message, error);
		return NextResponse.json({ error: message || "Unexpected error" }, { status: 400 });
	}
}
