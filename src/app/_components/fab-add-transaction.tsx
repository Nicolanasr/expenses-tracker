'use client';

import Link from 'next/link';

export function FloatingAddButton() {
    return (
        <Link
            href="/transactions"
            className="fixed bottom-6 right-6 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
            <span className="text-lg">＋</span>
        </Link>
    );
}
