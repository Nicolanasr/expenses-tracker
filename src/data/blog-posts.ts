export type BlogPost = {
	slug: string;
	title: string;
	excerpt: string;
	date: string;
	readingTime: string;
	tags: string[];
	heroImage: string;
	content: string;
};

export const blogPosts: BlogPost[] = [
	{
		slug: "expense-tracker-lebanon",
		title: "Expense tracker that actually works offline",
		excerpt: "Why we built Expenseo to be fully offline-ready with queued writes, PWA shell, and a read cache you can trust.",
		date: "2025-02-10",
		readingTime: "5 min",
		tags: ["offline", "pwa", "sync"],
		heroImage: "/images/blog/offline.jpg",
		content: `<p>Keeping your finance data usable when the network is flaky is core to Expenseo. We built a PWA shell, service-worker precache, and an IndexedDB-backed read cache so the app stays responsive even without signal.</p>
<p>On the write path, we queue mutations locally and replay when you're back online. Conflicts surface as notifications so you can resolve them without losing context.</p>
<p>If you want to ship something similar, start by defining which API calls can be cached, how to structure your outbox, and how to keep the UI optimistic without hiding failures.</p>`,
	},
	{
		slug: "multi-account-budgeting",
		title: "Multi-account budgeting without the spreadsheet mess",
		excerpt: "Tag transactions with accounts and keep transfers from polluting income/expense reports. Here’s how we designed it.",
		date: "2025-02-05",
		readingTime: "4 min",
		tags: ["accounts", "transfers", "budgets"],
		heroImage: "/images/blog/accounts.jpg",
		content: `<p>Most personal finance tools blur the line between transfers and income. We treat account transfers as their own type so reports stay accurate.</p>
<p>Accounts come with default payment methods to auto-select the right wallet or card. Transfers create linked transactions so balances stay consistent.</p>
<p>For budgeting, we exclude transfers from spend totals and show you per-account health so you always know what’s really available.</p>`,
	},
	{
		slug: "recurring-expense-automation",
		title: "Recurring expenses that actually auto-log",
		excerpt: "Schedules run every few hours in the background. If you’re offline, they catch up when you’re back.",
		date: "2025-01-28",
		readingTime: "3 min",
		tags: ["recurring", "automation"],
		heroImage: "/images/blog/recurring.jpg",
		content: `<p>We built a server-side recurring runner so you don’t have to open the app to log rent or salary. A lightweight cron pings our Edge Function every 6 hours.</p>
<p>Each run advances the next date, inserts a transaction, and drops a notification. You can still run schedules manually if you want instant control.</p>
<p>Want to implement this yourself? Keep the runner idempotent, log failures, and surface them in the UI so users always know what happened.</p>`,
	},
];

export function getBlogPost(slug: string): BlogPost | undefined {
	return blogPosts.find((post) => post.slug === slug);
}
