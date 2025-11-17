import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/server';

const TRANSACTION_SELECT = `
  id,
  amount,
  type,
  currency_code,
  occurred_on,
  payment_method,
  notes,
  category_id,
  categories (
    id,
    name,
    type,
    icon,
    color
  )
`;

const SORT_FIELDS = {
  recent: { column: 'occurred_on', ascending: false },
  oldest: { column: 'occurred_on', ascending: true },
  amount_desc: { column: 'amount', ascending: false },
  amount_asc: { column: 'amount', ascending: true },
} as const;

type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type CategoryRow = Database['public']['Tables']['categories']['Row'];

export type TransactionSortKey = keyof typeof SORT_FIELDS;

export type TransactionQueryFilters = {
  start: string;
  end: string;
  categoryIds?: string[];
  paymentMethod?: TransactionRow['payment_method'];
  search?: string;
  type?: TransactionRow['type'];
  minAmount?: number;
  maxAmount?: number;
  sort?: TransactionSortKey;
};

export type TransactionJoinedRow = TransactionRow & { categories: CategoryRow | null };

export async function fetchTransactionsPage(
  supabase: SupabaseClient<Database>,
  userId: string,
  { page, pageSize, filters }: { page: number; pageSize: number; filters: TransactionQueryFilters },
) {
  if (!filters.start || !filters.end) {
    throw new Error('Missing date range for transactions query');
  }

  const from = Math.max(0, (Math.max(1, Math.floor(page)) - 1) * pageSize);
  const to = from + pageSize - 1;

  let query = supabase
    .from('transactions')
    .select(TRANSACTION_SELECT, { count: 'exact' })
    .eq('user_id', userId)
    .gte('occurred_on', filters.start)
    .lte('occurred_on', filters.end);

  if (filters.categoryIds && filters.categoryIds.length) {
    query = query.in('category_id', filters.categoryIds);
  }
  if (filters.paymentMethod) {
    query = query.eq('payment_method', filters.paymentMethod);
  }
  if (filters.type === 'income' || filters.type === 'expense') {
    query = query.eq('type', filters.type);
  }
  if (typeof filters.minAmount === 'number' && !Number.isNaN(filters.minAmount)) {
    query = query.gte('amount', filters.minAmount);
  }
  if (typeof filters.maxAmount === 'number' && !Number.isNaN(filters.maxAmount)) {
    query = query.lte('amount', filters.maxAmount);
  }
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim().replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    query = query.or(`notes.ilike.${term},categories.name.ilike.${term}`);
  }

  const sortKey = filters.sort && filters.sort in SORT_FIELDS ? filters.sort : 'recent';
  const sortConfig = SORT_FIELDS[sortKey as TransactionSortKey] ?? SORT_FIELDS.recent;
  query = query
    .order(sortConfig.column, { ascending: sortConfig.ascending })
    .order('created_at', { ascending: sortConfig.ascending })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  return {
    rows: (data ?? []) as TransactionJoinedRow[],
    total: count ?? 0,
  };
}
