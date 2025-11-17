'use client';

import { useActionState, useEffect, useRef, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import toast from 'react-hot-toast';

import { createCategory } from '@/app/actions';
import { queueCategoryMutation } from '@/lib/outbox-sync';

type FormState = {
  ok: boolean;
  errors?: Record<string, string[] | undefined>;
};

const INITIAL_STATE: FormState = { ok: false, errors: {} };

const ICON_SUGGESTIONS = [
  '🏷️',
  '🛒',
  '☕️',
  '🏠',
  '💡',
  '🚗',
  '🩺',
  '💼',
  '📈',
  '✈️',
  '💰',
] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
    >
      {pending ? 'Saving…' : 'Add Category'}
    </button>
  );
}

export function CreateCategoryForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(createCategory, INITIAL_STATE);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      toast.success('Category saved');
    } else if (state.errors && Object.keys(state.errors).length) {
      const first = Object.values(state.errors)[0]?.[0];
      if (first) toast.error(first);
    }
  }, [state.ok, state.errors]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        queueCategoryMutation({ type: 'create', data: Object.fromEntries(formData.entries()) });
        toast.success('Queued offline — will sync when online');
        event.currentTarget.reset();
        return;
      }
      formAction(formData);
    },
    [formAction],
  );

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Create a new category
        </h3>
        <p className="text-xs text-slate-600">
          Use categories to group your income and spending.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="category-name"
          className="text-sm font-semibold text-slate-800"
        >
          Name
        </label>
        <input
          id="category-name"
          name="name"
          type="text"
          required
          placeholder="e.g. Groceries"
          className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
        />
        {state.errors?.name?.length ? (
          <p className="text-xs text-red-500">{state.errors.name[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="category-type"
          className="text-sm font-semibold text-slate-800"
        >
          Type
        </label>
        <select
          id="category-type"
          name="type"
          defaultValue="expense"
          className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        {state.errors?.type?.length ? (
          <p className="text-xs text-red-500">{state.errors.type[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="category-icon"
          className="text-sm font-semibold text-slate-800"
        >
          Icon
        </label>
        <input
          id="category-icon"
          name="icon"
          type="text"
          defaultValue="🏷️"
          placeholder="Pick an emoji"
          list="category-icon-options"
          className="h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
        />
        <datalist id="category-icon-options">
          {ICON_SUGGESTIONS.map((icon) => (
            <option key={icon} value={icon}>
              {icon}
            </option>
          ))}
        </datalist>
        <p className="text-xs text-slate-500">
          Use a single emoji to make the category easy to spot.
        </p>
        {state.errors?.icon?.length ? (
          <p className="text-xs text-red-500">{state.errors.icon[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="category-color"
          className="text-sm font-semibold text-slate-800"
        >
          Accent color
        </label>
        <input
          id="category-color"
          name="color"
          type="color"
          defaultValue="#6366f1"
          className="h-11 w-20 cursor-pointer rounded-lg border border-slate-300 p-1 outline-none transition focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-100"
        />
        {state.errors?.color?.length ? (
          <p className="text-xs text-red-500">{state.errors.color[0]}</p>
        ) : null}
      </div>

      {state.ok ? (
        <p className="text-xs font-medium text-emerald-600">
          Category saved. You can add another one now.
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
