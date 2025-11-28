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
  const [showConfirm, setShowConfirm] = useState(false);

  const handleConfirmDelete = () => {
    setPending(true);
    setShowConfirm(false);
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
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={pending}
        className="rounded-full border border-red-200 p-2 text-red-600 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Delete category"
        title="Delete category"
      >
        {pending ? '…' : '🗑️'}
      </button>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <p className="text-sm font-semibold text-slate-900">Delete &ldquo;{category.name}&rdquo;?</p>
            <p className="mt-2 text-xs text-slate-600">Transactions in this category will be uncategorised.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                onClick={() => setShowConfirm(false)}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
                onClick={handleConfirmDelete}
                disabled={pending}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
