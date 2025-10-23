'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { SignOutButton } from '@/app/_components/sign-out-button';

const NAV_ITEMS = [
  { href: '/', label: 'Overview' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/categories', label: 'Categories' },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">
            Expense Tracker
          </p>
          <h1 className="text-lg font-semibold text-slate-900">
            Stay on top of your money
          </h1>
        </div>
        <nav className="flex items-center gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 rounded-full border px-3 py-2 text-center text-sm font-semibold transition ${
                  isActive
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
                    : 'border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="pt-1">
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
