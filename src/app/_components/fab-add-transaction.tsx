'use client';

import Link from 'next/link';

type FloatingAddButtonProps = {
    visible?: boolean;
};

export function FloatingAddButton({ visible = true }: FloatingAddButtonProps) {
    if (!visible) {
        return null;
    }

    return (
        <Link
            href="/transactions"
            className="fixed bottom-24 right-4 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 sm:bottom-10 sm:right-6 md:bottom-12 md:right-10"
        >
            <span className="text-lg">＋</span>
        </Link>
    );
}
