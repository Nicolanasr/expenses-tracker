import { NextResponse } from 'next/server';

import { createSupabaseServerActionClient } from '@/lib/supabase/server';
import { fetchTransactionsPage, type TransactionQueryFilters } from '@/lib/transactions/pagination';

const ALLOWED_PAGE_SIZES = [7, 14, 28, 56, 112];
const DEFAULT_PAGE_SIZE = 14;

const PAYMENT_METHODS = ['card', 'cash', 'transfer', 'other'] as const;

type RequestBody = {
  page?: number;
  pageSize?: number;
  filters?: TransactionQueryFilters;
};

const sanitizePageSize = (value?: number) => {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_PAGE_SIZE;
  }
  const rounded = Math.max(1, Math.floor(value));
  return ALLOWED_PAGE_SIZES.includes(rounded) ? rounded : DEFAULT_PAGE_SIZE;
};

const sanitizePage = (value?: number) => {
  if (!value || Number.isNaN(value)) {
    return 1;
  }
  return Math.max(1, Math.floor(value));
};

const sanitizeFilters = (filters?: TransactionQueryFilters): TransactionQueryFilters => {
  if (!filters) {
    throw new Error('Missing filters');
  }
  const { start, end } = filters;
  if (!start || !end) {
    throw new Error('Missing date range');
  }
  const normalizedCategoryIds = Array.isArray(filters.categoryIds)
    ? filters.categoryIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : undefined;
  return {
    start,
    end,
    categoryIds: normalizedCategoryIds && normalizedCategoryIds.length ? normalizedCategoryIds : undefined,
    paymentMethod: filters.paymentMethod && PAYMENT_METHODS.includes(filters.paymentMethod) ? filters.paymentMethod : undefined,
    search: filters.search?.slice(0, 100) || undefined,
    type: filters.type === 'income' || filters.type === 'expense' ? filters.type : undefined,
    minAmount: typeof filters.minAmount === 'number' ? filters.minAmount : undefined,
    maxAmount: typeof filters.maxAmount === 'number' ? filters.maxAmount : undefined,
    sort: filters.sort,
  };
};

export async function POST(request: Request) {
  try {
    const { page: rawPage, pageSize: rawPageSize, filters: rawFilters }: RequestBody = await request.json();
    const filters = sanitizeFilters(rawFilters);
    const page = sanitizePage(rawPage);
    const pageSize = sanitizePageSize(rawPageSize);

    const supabase = createSupabaseServerActionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('currency_code')
      .eq('user_id', user.id)
      .maybeSingle();

    const currencyCode = settings?.currency_code ?? 'USD';

    const { rows, total } = await fetchTransactionsPage(supabase, user.id, {
      page,
      pageSize,
      filters,
    });

    const transactions = rows.map((transaction) => ({
      id: transaction.id,
      amount: Number(transaction.amount ?? 0),
      type: transaction.type,
      currencyCode: transaction.currency_code ?? currencyCode,
      occurredOn: transaction.occurred_on,
      paymentMethod: transaction.payment_method,
      notes: transaction.notes,
      updatedAt: transaction.updated_at,
      categoryId: transaction.category_id ?? transaction.categories?.id ?? null,
      category: transaction.categories
        ? {
            id: transaction.categories.id,
            name: transaction.categories.name,
            icon: transaction.categories.icon,
            color: transaction.categories.color,
            type: transaction.categories.type,
          }
        : null,
    }));

    return NextResponse.json({
      transactions,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('[api] transactions/page error', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
