'use client';

import { useActionState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

import { type FormState, updateCategory } from '@/app/categories/actions';
import { queueCategoryMutation } from '@/lib/outbox-sync';

const INITIAL_STATE: FormState = { ok: false, errors: {} };

type Props = {
  category: {
    id: string;
    name: string;
    icon: string;
    color: string;
    updated_at: string;
  };
  onCancel: () => void;
};

export default function CategoryEditForm({ category, onCancel }: Props) {
  const [state, formAction] = useActionState<FormState, FormData>(
    updateCategory,
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok) {
      onCancel();
      toast.success('Category updated');
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state.ok, onCancel, state.error]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        queueCategoryMutation({ type: 'update', data: Object.fromEntries(formData.entries()) });
        toast.success('Queued offline — will sync when online');
        onCancel();
        return;
      }
      formAction(formData);
    },
    [formAction, onCancel],
  );

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
      <input type="hidden" name="id" value={category.id} />
      <input type="hidden" name="updated_at" value={category.updated_at} />
      <div className="grid gap-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Name
        </label>
        <input
          name="name"
          defaultValue={category.name}
          required
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
        />
        {state.errors?.name?.length ? (
          <p className="text-xs text-red-500">{state.errors.name[0]}</p>
        ) : null}
      </div>
      <div className="grid gap-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Icon
        </label>
        <input
          name="icon"
          defaultValue={category.icon}
          required
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
        />
        {state.errors?.icon?.length ? (
          <p className="text-xs text-red-500">{state.errors.icon[0]}</p>
        ) : null}
      </div>
      <div className="grid gap-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Colour
        </label>
        <input
          name="color"
          type="color"
          defaultValue={category.color}
          required
          className="h-9 w-20 rounded-lg border border-slate-200"
        />
        {state.errors?.color?.length ? (
          <p className="text-xs text-red-500">{state.errors.color[0]}</p>
        ) : null}
      </div>
      {state.error ? (
        <p className="text-xs text-red-500">{state.error}</p>
      ) : null}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-700"
        >
          Save changes
        </button>
      </div>
    </form>
  );
}
