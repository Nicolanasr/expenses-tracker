'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { SignOutButton } from '@/app/_components/sign-out-button';
import { FaRegUser } from 'react-icons/fa';
import Image from 'next/image';

const NAV_ITEMS = [
    { href: '/', label: 'Overview' },
    { href: '/transactions', label: 'Transactions' },
    { href: '/transfers', label: 'Transfers' },
    { href: '/categories', label: 'Categories' },
    { href: '/budgets', label: 'Budgets' },
];

export function MobileNav() {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex gap-0 items-center">
                        <div>
                            <Image src="/expenseo-logo-removebg-preview.png" alt='logo' width={50} height={50} className='object-contain' />
                        </div>
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">
                                Expenseo
                            </p>
                            <h1 className="text-lg font-semibold text-slate-900">
                                Stay on top of your money
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setMenuOpen((prev) => !prev)}
                                className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition ${menuOpen
                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                                    : 'border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
                                    }`}
                                aria-label="Open account menu"
                            >
                                <FaRegUser />
                            </button>
                            {menuOpen ? (
                                <div className="absolute right-0 z-30 mt-2 w-44 rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
                                    <Link
                                        href="/profile"
                                        className="block rounded-xl px-2 py-1.5 text-slate-700 transition hover:bg-slate-50"
                                        onClick={() => setMenuOpen(false)}
                                    >
                                        Profile
                                    </Link>
                                    <Link
                                        href="/account"
                                        className="mt-1 block rounded-xl px-2 py-1.5 text-slate-700 transition hover:bg-slate-50"
                                        onClick={() => setMenuOpen(false)}
                                    >
                                        Account settings
                                    </Link>
                                    <div className="mt-2 border-t border-slate-100 pt-2">
                                        <SignOutButton />
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                <nav className="flex items-center gap-2 overflow-auto">
                    {NAV_ITEMS.map((item) => {
                        const isActive =
                            item.href === '/'
                                ? pathname === '/'
                                : pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex-1 rounded-full border px-3 py-2 text-center text-sm font-semibold transition ${isActive
                                    ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
                                    : 'border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
                                    }`}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </header>
    );
}
