'use client';

import { useTransition } from 'react';
import toast from 'react-hot-toast';

import type { TransactionFilters } from '@/app/_components/transactions-paginated-list';

type Props = {
  filters: TransactionFilters;
};

export function TransactionsExportButton({ filters }: Props) {
  const [isPending, startTransition] = useTransition();

  const handleExport = () => {
    startTransition(async () => {
      try {
        const response = await fetch('/api/transactions/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || 'Export failed');
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'transactions.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('CSV exported');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Export failed');
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? 'Exporting…' : 'Export CSV'}
    </button>
  );
}
