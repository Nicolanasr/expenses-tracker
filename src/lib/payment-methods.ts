export const SELECTABLE_PAYMENT_METHODS = ["card", "cash", "bank_transfer", "other"] as const;
export const ALL_PAYMENT_METHODS = [...SELECTABLE_PAYMENT_METHODS, "account_transfer"] as const;

export type SelectablePaymentMethod = (typeof SELECTABLE_PAYMENT_METHODS)[number];
export type PaymentMethod = (typeof ALL_PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
	card: "Card",
	cash: "Cash",
	bank_transfer: "Bank transfer",
	account_transfer: "Account transfer",
	other: "Other",
};

export function normalizePaymentMethod(value: string | null | undefined): PaymentMethod {
	if (!value) return "other";
	if (value === "transfer") return "bank_transfer";
	if ((ALL_PAYMENT_METHODS as readonly string[]).includes(value)) {
		return value as PaymentMethod;
	}
	return "other";
}
