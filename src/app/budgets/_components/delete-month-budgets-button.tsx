'use client';

import { useTransition } from 'react';
import toast from 'react-hot-toast';

import { deleteMonthBudgetsAction } from '@/app/budgets/actions';

export function DeleteMonthBudgetsButton({ month }: { month: string }) {
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        if (!month) return;
        const first = confirm(`Delete every budget for ${month}?`);
        if (!first) return;
        const second = confirm('This cannot be undone. Delete all budgets for this month?');
        if (!second) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            toast.error('Go online to delete budgets.');
            return;
        }
        const formData = new FormData();
        formData.append('month', month);
        startTransition(async () => {
            try {
                await deleteMonthBudgetsAction(formData);
                toast.success('All budgets removed for this month.');
            } catch (error) {
                console.error(error);
                toast.error('Unable to delete month budgets.');
            }
        });
    };

    return (
        <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
            {isPending ? 'Removing…' : `Delete ${month} budgets`}
        </button>
    );
}

