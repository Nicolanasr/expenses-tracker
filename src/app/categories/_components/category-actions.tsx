'use client';

import { useActionState } from 'react';

import { deleteCategory } from '@/app/categories/actions';

const INITIAL_STATE = { ok: false, error: '' };

type Props = {
  categoryId: string;
};

export function CategoryRemoveButton({ categoryId }: Props) {
  const [state, formAction] = useActionState(deleteCategory, INITIAL_STATE);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={categoryId} />
      <button
        type="submit"
        className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:text-red-700"
        onClick={(event) => {
          if (!window.confirm('Delete this category? Transactions will be uncategorised.')) {
            event.preventDefault();
          }
        }}
      >
        {state.ok ? 'Deleted' : 'Delete'}
      </button>
      {state.error ? (
        <p className="mt-1 text-xs text-red-500">{state.error}</p>
      ) : null}
    </form>
  );
}
