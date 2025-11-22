import { NextResponse } from 'next/server';

import { createSupabaseServerActionClient } from '@/lib/supabase/server';
import { type TransactionQueryFilters } from '@/lib/transactions/pagination';
import { ALL_PAYMENT_METHODS, normalizePaymentMethod } from '@/lib/payment-methods';

type RequestBody = {
  filters?: TransactionQueryFilters;
};

const sanitizeFilters = (filters?: TransactionQueryFilters): TransactionQueryFilters => {
  if (!filters) {
    throw new Error('Missing filters');
  }
  const { start, end } = filters;
  if (!start || !end) {
    throw new Error('Missing date range');
  }
  const normalizedCategories = Array.isArray(filters.categoryIds)
    ? filters.categoryIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : undefined;
  return {
    start,
    end,
    categoryIds: normalizedCategories && normalizedCategories.length ? normalizedCategories : undefined,
    paymentMethod:
      filters.paymentMethod && (ALL_PAYMENT_METHODS as readonly string[]).includes(filters.paymentMethod)
        ? filters.paymentMethod
        : undefined,
    search: filters.search?.slice(0, 100) || undefined,
    type: filters.type === 'income' || filters.type === 'expense' ? filters.type : undefined,
    minAmount: typeof filters.minAmount === 'number' ? filters.minAmount : undefined,
    maxAmount: typeof filters.maxAmount === 'number' ? filters.maxAmount : undefined,
    sort: filters.sort,
  };
};

function toCsvValue(value: unknown) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function POST(request: Request) {
  try {
    const { filters: rawFilters }: RequestBody = await request.json();
    const filters = sanitizeFilters(rawFilters);

    const supabase = createSupabaseServerActionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sortKey = filters.sort === 'oldest' || filters.sort === 'amount_desc' || filters.sort === 'amount_asc' ? filters.sort : 'recent';
    const sortConfig =
      sortKey === 'oldest'
        ? { column: 'occurred_on', ascending: true }
        : sortKey === 'amount_desc'
          ? { column: 'amount', ascending: false }
          : sortKey === 'amount_asc'
            ? { column: 'amount', ascending: true }
            : { column: 'occurred_on', ascending: false };

    let query = supabase
      .from('transactions')
      .select(
        `
        id,
        amount,
        type,
        currency_code,
        occurred_on,
        payment_method,
        notes,
        category_id,
        categories (name)
      `,
      )
      .eq('user_id', user.id)
      .gte('occurred_on', filters.start)
      .lte('occurred_on', filters.end);

    if (filters.categoryIds?.length) {
      query = query.in('category_id', filters.categoryIds);
    }
    if (filters.paymentMethod) {
      query = query.eq('payment_method', filters.paymentMethod);
    }
    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (typeof filters.minAmount === 'number') {
      query = query.gte('amount', filters.minAmount);
    }
    if (typeof filters.maxAmount === 'number') {
      query = query.lte('amount', filters.maxAmount);
    }
    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim().replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
      query = query.or(`notes.ilike.${term},categories.name.ilike.${term}`);
    }

    const { data, error } = await query
      .order(sortConfig.column, { ascending: sortConfig.ascending })
      .order('created_at', { ascending: sortConfig.ascending });

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    const header = ['Date', 'Amount', 'Currency', 'Type', 'Category', 'Payment method', 'Notes'];
    const csvLines = [
      header.join(','),
      ...rows.map((row) =>
        [
          toCsvValue(row.occurred_on),
          toCsvValue(row.amount),
          toCsvValue(row.currency_code),
          toCsvValue(row.type),
          toCsvValue((row as { categories?: { name?: string } }).categories?.name ?? ''),
          toCsvValue(normalizePaymentMethod(row.payment_method)),
          toCsvValue(row.notes ?? ''),
        ].join(','),
      ),
    ];

    const csv = csvLines.join('\n');
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="transactions-${filters.start}-${filters.end}.csv"`,
      },
    });
  } catch (error) {
    console.error('[transactions-export] error', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
