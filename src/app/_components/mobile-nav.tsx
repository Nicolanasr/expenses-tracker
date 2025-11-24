'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';

import { SignOutButton } from '@/app/_components/sign-out-button';
import { FaRegUser } from 'react-icons/fa';
import Image from 'next/image';
import { markAllNotificationsReadAction, markNotificationReadAction } from '@/app/notifications/actions';

function formatRelativeTime(timestamp: string) {
	const now = Date.now();
	const value = new Date(timestamp).getTime();
	if (Number.isNaN(value)) return '';
	const diffSeconds = Math.max(0, Math.floor((now - value) / 1000));

	const intervals: [number, string][] = [
		[60, 'second'],
		[60, 'minute'],
		[24, 'hour'],
		[7, 'day'],
		[4.34524, 'week'],
		[12, 'month'],
		[Number.POSITIVE_INFINITY, 'year'],
	];

	let count = diffSeconds;
	let unit = 'second';

	for (let i = 0; i < intervals.length; i++) {
		const [threshold, name] = intervals[i];
		if (count < threshold || i === intervals.length - 1) {
			unit = name;
			break;
		}
		count = Math.floor(count / threshold);
	}

	if (count <= 1 && unit === 'second') return 'just now';
	return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

export type NotificationItem = {
	id: string;
	title: string;
	body: string | null;
	type: 'recurring_due' | 'recurring_logged' | 'budget_threshold' | string;
	status: 'unread' | 'read';
	created_at: string;
	metadata?: Record<string, unknown> | null;
};

const NAV_ITEMS = [
	{ href: '/', label: 'Overview' },
	{ href: '/transactions', label: 'Transactions' },
	{ href: '/transfers', label: 'Transfers' },
	{ href: '/categories', label: 'Categories' },
	{ href: '/budgets', label: 'Budgets' },
	{ href: '/activity', label: 'Activity' },
];

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
	recurring_due: 'Recurring due',
	recurring_logged: 'Recurring logged',
	budget_threshold: 'Budget alert',
};

export function MobileNav() {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isPending, startTransition] = useTransition();

    const fetchNotifications = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/notifications', { cache: 'no-store' });
            if (response.ok) {
                const payload = await response.json();
                setNotifications(payload.notifications ?? []);
            }
        } catch (error) {
            console.error('[notifications] unable to fetch', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const unreadNotifications = notifications.filter((notification) => notification.status === 'unread').length;

    const handleMarkRead = (id: string) => {
        startTransition(() => {
            const formData = new FormData();
            formData.append('notification_id', id);
            markNotificationReadAction(formData).then(fetchNotifications);
        });
    };

    const handleMarkAll = () => {
        startTransition(() => {
            markAllNotificationsReadAction().then(fetchNotifications);
        });
    };

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
                                onClick={() => setNotificationsOpen((prev) => !prev)}
                                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
                                aria-label="Notifications"
                            >
                                <span className="text-lg">🔔</span>
                                {unreadNotifications > 0 ? (
                                    <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[0.65rem] font-semibold text-white">
                                        {unreadNotifications > 9 ? '9+' : unreadNotifications}
                                    </span>
                                ) : null}
                            </button>
                            {notificationsOpen ? (
                                <div className="absolute right-0 z-30 mt-2 w-96 rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
                                    <div className="mb-2 flex items-center justify-between">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notifications</p>
                                        {unreadNotifications > 0 ? (
                                            <button
                                                type="button"
                                                onClick={handleMarkAll}
                                                disabled={isPending}
                                                className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {isPending ? 'Marking…' : 'Mark all read'}
                                            </button>
                                        ) : null}
                                    </div>
                                    <div className="max-h-72 space-y-2 overflow-auto">
                                        {isLoading ? (
                                            <p className="text-xs text-slate-500">Loading…</p>
                                        ) : notifications.length === 0 ? (
                                            <p className="text-xs text-slate-500">No notifications yet.</p>
                                        ) : (
									notifications.slice(0, 8).map((notification) => {
										const typeLabel = NOTIFICATION_TYPE_LABELS[notification.type] ?? 'Update';
										return (
											<div
												key={notification.id}
												className={`rounded-xl border px-3 py-2 text-xs ${notification.status === 'unread'
													? 'border-indigo-200 bg-indigo-50/70'
													: 'border-slate-100'
													}`}
											>
												<div className="flex items-center justify-between gap-2">
														<p className="font-semibold text-slate-900">{notification.title}</p>
														<span className="text-[0.7rem] text-slate-400">
															{formatRelativeTime(notification.created_at)}
														</span>
													</div>
												{notification.body ? (
													<p className="mt-1 text-slate-600">{notification.body}</p>
												) : null}
												<div className="mt-1 flex items-center gap-2">
													<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-600">
														{typeLabel}
													</span>
													{notification.status === 'unread' ? (
														<button
															type="button"
															onClick={() => handleMarkRead(notification.id)}
															disabled={isPending}
															className="text-[0.65rem] font-semibold text-indigo-600 transition hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
														>
															{isPending ? 'Working…' : 'Mark read'}
														</button>
													) : (
														<span className="text-[0.65rem] text-slate-400">Read</span>
													)}
												</div>
											</div>
										);
									})
                                        )}
                                    </div>
                                </div>
                            ) : null}
                        </div>
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
