"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerActionClient } from "@/lib/supabase/server";

const transferSchema = z.object({
    from_account_id: z.string().uuid({ message: "Select a source account" }),
    to_account_id: z.string().uuid({ message: "Select a destination account" }),
    amount: z
        .string({ error: "Amount is required" })
        .transform((val) => Number(val))
        .refine((val) => !Number.isNaN(val) && val > 0, { message: "Enter a valid amount" }),
    occurred_on: z.string().min(1, "Date is required"),
    notes: z
        .string()
        .max(200, "Keep notes under 200 characters")
        .optional()
        .or(z.literal(""))
        .transform((val) => (val ? val : undefined)),
});

export type TransferFormState = {
    ok: boolean;
    errors?: Record<string, string[] | undefined>;
    message?: string;
};

async function fetchAccountBalances(
    supabase: Awaited<ReturnType<typeof createSupabaseServerActionClient>>,
    userId: string,
    accountIds: string[],
) {
    if (!accountIds.length) return new Map<string, number>();

    const { data: accountRows, error: accountsError } = await supabase
        .from('accounts')
        .select('id, starting_balance')
        .eq('user_id', userId)
        .in('id', accountIds);

    if (accountsError) {
        throw accountsError;
    }

    const balances = new Map<string, number>();
    (accountRows ?? []).forEach((account) => {
        balances.set(account.id, Number(account.starting_balance ?? 0));
    });

    if (!accountRows?.length) {
        return balances;
    }

    const { data: transactionRows, error: transactionError } = await supabase
        .from('transactions')
        .select('account_id, type, amount')
        .eq('user_id', userId)
        .in('account_id', accountIds);

    if (transactionError) {
        throw transactionError;
    }

    (transactionRows ?? []).forEach((row) => {
        if (!row.account_id) return;
        const current = balances.get(row.account_id) ?? 0;
        const amount = Number(row.amount ?? 0);
        const next = row.type === 'income' ? current + amount : current - amount;
        balances.set(row.account_id, next);
    });

    return balances;
}

export async function createTransferAction(_prev: TransferFormState, formData: FormData): Promise<TransferFormState> {
    const supabase = await createSupabaseServerActionClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return { ok: false, message: 'You must be signed in.' };
    }

    const payload = transferSchema.safeParse({
        from_account_id: formData.get('from_account_id'),
        to_account_id: formData.get('to_account_id'),
        amount: formData.get('amount'),
        occurred_on: formData.get('occurred_on'),
        notes: formData.get('notes'),
    });

    if (!payload.success) {
        return {
            ok: false,
            errors: payload.error.flatten().fieldErrors,
        };
    }

    if (payload.data.from_account_id === payload.data.to_account_id) {
        return { ok: false, message: 'Pick two different accounts.' };
    }

    const { data: accountRows, error: accountsError } = await supabase
        .from('accounts')
        .select('id, name, starting_balance')
        .eq('user_id', user.id)
        .in('id', [payload.data.from_account_id, payload.data.to_account_id]);

    if (accountsError) {
        console.error(accountsError);
        return { ok: false, message: 'Unable to load accounts.' };
    }

    if ((accountRows ?? []).length < 2) {
        return { ok: false, message: 'Select accounts you own.' };
    }

    const accountsMap = new Map(accountRows?.map((row) => [row.id, row]));
    const fromAccount = accountsMap.get(payload.data.from_account_id);
    const toAccount = accountsMap.get(payload.data.to_account_id);

    if (!fromAccount || !toAccount) {
        return { ok: false, message: 'Select valid accounts.' };
    }

    try {
        const balances = await fetchAccountBalances(supabase, user.id, [payload.data.from_account_id, payload.data.to_account_id]);
        const fromBalance = balances.get(payload.data.from_account_id) ?? 0;
        if (fromBalance < payload.data.amount) {
            return { ok: false, message: 'Insufficient balance in source account.' };
        }
    } catch (error) {
        console.error(error);
        return { ok: false, message: 'Unable to verify balance.' };
    }

    const occurredOn = payload.data.occurred_on;
    const { data: settings } = await supabase
        .from('user_settings')
        .select('currency_code')
        .eq('user_id', user.id)
        .maybeSingle();

    const currencyCode = settings?.currency_code ?? 'USD';

    const inserts = [
        {
            user_id: user.id,
            amount: payload.data.amount,
            occurred_on: occurredOn,
            payment_method: 'transfer' as const,
            notes: payload.data.notes ?? null,
            payee: `Transfer to ${toAccount.name}`,
            account_id: payload.data.from_account_id,
            category_id: null,
            type: 'expense' as const,
            currency_code: currencyCode,
        },
        {
            user_id: user.id,
            amount: payload.data.amount,
            occurred_on: occurredOn,
            payment_method: 'transfer' as const,
            notes: payload.data.notes ?? null,
            payee: `Transfer from ${fromAccount.name}`,
            account_id: payload.data.to_account_id,
            category_id: null,
            type: 'income' as const,
            currency_code: currencyCode,
        },
    ];

    const { error: insertError } = await supabase.from('transactions').insert(inserts);
    if (insertError) {
        console.error(insertError);
        return { ok: false, message: 'Unable to record transfer.' };
    }

    revalidatePath('/');
    revalidatePath('/transactions');
    revalidatePath('/transfers');
    return { ok: true, message: 'Transfer saved.' };
}
