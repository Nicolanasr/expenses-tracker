'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createSupabaseServerActionClient } from '@/lib/supabase/server';

const categorySchema = z.object({
  name: z
    .string({ required_error: 'Category name is required' })
    .min(2, 'Category name should be at least 2 characters')
    .max(40, 'Category name should be less than 40 characters'),
  type: z.enum(['income', 'expense']),
  icon: z
    .string({ required_error: 'Icon is required' })
    .min(1, 'Pick an emoji to help recognize the category')
    .max(4, 'Keep the icon short (use a single emoji)'),
  color: z
    .string()
    .regex(/^#([0-9a-f]{3}){1,2}$/i, 'Provide a valid hex color')
    .default('#6366f1'),
});

const transactionSchema = z.object({
  amount: z
    .string({ required_error: 'Amount is required' })
    .transform((val) => Number(val))
    .refine((val) => !Number.isNaN(val) && val > 0, {
      message: 'Amount must be a positive number',
    }),
  occurred_on: z.string().min(1, 'Date is required'),
  category_id: z.string().uuid({ message: 'Pick a valid category' }),
  payment_method: z.enum(['cash', 'card', 'transfer', 'other']),
  notes: z.string().optional(),
});

export async function createCategory(_: unknown, formData: FormData) {
  const payload = categorySchema.safeParse({
    name: formData.get('name'),
    type: formData.get('type'),
    icon: formData.get('icon') ?? '🏷️',
    color: formData.get('color') ?? '#6366f1',
  });

  if (!payload.success) {
    return {
      ok: false,
      errors: payload.error.flatten().fieldErrors,
    };
  }

  const supabase = await createSupabaseServerActionClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      errors: {
        name: ['You must be signed in to add categories.'],
      },
    };
  }

  const { error } = await supabase.from('categories').insert({
    name: payload.data.name.trim(),
    type: payload.data.type,
    icon: payload.data.icon,
    user_id: user.id,
    color: payload.data.color,
  });

  if (error) {
    console.error(error);
    return {
      ok: false,
      errors: { name: ['Unable to save category, try again.'] },
    };
  }

  revalidatePath('/');
  revalidatePath('/categories');
  revalidatePath('/transactions');
  return { ok: true };
}

export async function createTransaction(_: unknown, formData: FormData) {
  const supabase = await createSupabaseServerActionClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      errors: {
        category_id: ['You must be signed in to record transactions.'],
      },
    };
  }

  const categoriesResponse = await supabase
    .from('categories')
    .select('id, type');

  if (categoriesResponse.error) {
    console.error(categoriesResponse.error);
    return {
      ok: false,
      errors: {
        category_id: ['Unable to validate categories.'],
      },
    };
  }

  const payload = transactionSchema.safeParse({
    amount: formData.get('amount'),
    category_id: formData.get('category_id'),
    occurred_on: formData.get('occurred_on'),
    payment_method: formData.get('payment_method'),
    notes: formData.get('notes'),
  });

  if (!payload.success) {
    return {
      ok: false,
      errors: payload.error.flatten().fieldErrors,
    };
  }

  const category = categoriesResponse.data.find(
    (item) => item.id === payload.data.category_id,
  );

  if (!category) {
    return {
      ok: false,
      errors: {
        category_id: ['Pick a category before creating a transaction.'],
      },
    };
  }

  const { error } = await supabase.from('transactions').insert({
    amount: payload.data.amount,
    occurred_on: payload.data.occurred_on,
    payment_method: payload.data.payment_method,
    notes: payload.data.notes ?? null,
    category_id: payload.data.category_id,
    type: category.type,
    user_id: user.id,
  });

  if (error) {
    console.error(error);
    return {
      ok: false,
      errors: { amount: ['Unable to record transaction, try again.'] },
    };
  }

  revalidatePath('/');
  return { ok: true };
}
