'use client';

import { useState } from 'react';

import CategoryEditForm from '@/app/categories/_components/category-edit-form';
import { CategoryRemoveButton } from '@/app/categories/_components/category-actions';

type CategoryRowProps = {
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    type: 'income' | 'expense';
    created_at: string;
  };
};

export function CategoryRow({ category }: CategoryRowProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-lg"
            style={{
              color: category.color ?? '#4f46e5',
              borderColor: category.color ?? '#c7d2fe',
            }}
            aria-hidden
          >
            {category.icon ?? '🏷️'}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">{category.name}</p>
            <p className="text-xs font-medium uppercase text-slate-500">
              {category.type}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
          <CategoryRemoveButton categoryId={category.id} />
        </div>
      </div>

      {isEditing ? (
        <CategoryEditForm
          category={{
            id: category.id,
            name: category.name,
            icon: category.icon ?? '🏷️',
            color: category.color ?? '#4f46e5',
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : null}

      <time className="block text-xs text-slate-500">
        Added {new Date(category.created_at).toLocaleDateString()}
      </time>
    </article>
  );
}
