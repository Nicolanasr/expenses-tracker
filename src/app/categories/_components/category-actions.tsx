'use client';

import { startTransition, useState } from 'react';
import toast from 'react-hot-toast';

import { deleteCategoryById, restoreCategory } from '@/app/categories/actions';
import { queueCategoryMutation } from '@/lib/outbox-sync';

type Props = {
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    type: 'income' | 'expense';
    updated_at: string;
  };
};

export function CategoryRemoveButton({ category }: Props) {
  const [pending, setPending] = useState(false);

    const handleDelete = (event: React.MouseEvent) => {
      event.preventDefault();
      if (!window.confirm('Delete this category? Transactions will be uncategorised.')) {
        return;
      }
      setPending(true);
      startTransition(async () => {
        const deleted = category;
        try {
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            await queueCategoryMutation({ type: 'delete', data: { id: category.id, updated_at: category.updated_at } });
            toast.success('Queued delete — will sync when online');
            setPending(false);
            return;
          }
        await deleteCategoryById(category.id, category.updated_at);
          toast.custom((t) => (
            <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm shadow-lg border border-slate-200">
              <span className="font-semibold text-slate-900">Category deleted</span>
              <button
              type="button"
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600"
              onClick={() => {
                toast.dismiss(t.id);
                startTransition(async () => {
                  try {
                    await restoreCategory(deleted);
                    toast.success('Category restored');
                  } catch {
                    toast.error('Unable to restore category');
                  }
                });
              }}
            >
              Undo
            </button>
          </div>
        ));
      } catch {
        setPending(false);
        toast.error('Unable to delete category.');
        return;
      }
      setPending(false);
    });
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="rounded-full border border-red-200 p-2 text-red-600 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      aria-label="Delete category"
      title="Delete category"
    >
      {pending ? '…' : '🗑️'}
    </button>
  );
}
