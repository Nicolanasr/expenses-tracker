import type { Metadata } from "next";

const SITE = "https://expenseo.online";

type BlogKey =
	| "how-to-start-tracking-expenses"
	| "expense-categories-to-track"
	| "how-to-build-a-monthly-budget"
	| "how-to-track-shared-expenses"
	| "best-expense-tracking-apps-2025"
	| "why-you-keep-failing-at-budgeting";

const blogs: Record<
	BlogKey,
	{
		slug: BlogKey;
		path: string;
		title: string;
		description: string;
		metaTitle: string;
	}
> = {
	"how-to-start-tracking-expenses": {
		slug: "how-to-start-tracking-expenses",
		path: "/blog/how-to-start-tracking-expenses",
		title: "How to Start Tracking Your Expenses in 2025 (Beginner-Friendly Guide)",
		description:
			"Learn how to start tracking your expenses easily in 2025. A beginner-friendly guide with simple steps, examples, and tools to help you control your spending.",
		metaTitle: "How to Start Tracking Your Expenses in 2025 (Beginner Guide)",
	},
	"expense-categories-to-track": {
		slug: "expense-categories-to-track",
		path: "/blog/expense-categories-to-track",
		title: "Top 10 Expense Categories Everyone Should Track (With Examples)",
		description:
			"Discover the 10 most important expense categories everyone should track. Includes clear examples and tips to improve your budgeting.",
		metaTitle: "Top 10 Expense Categories Everyone Should Track (With Examples)",
	},
	"how-to-build-a-monthly-budget": {
		slug: "how-to-build-a-monthly-budget",
		path: "/blog/how-to-build-a-monthly-budget",
		title: "How to Build a Monthly Budget You Will Actually Stick To",
		description:
			"Learn a practical way to build a monthly budget you can finally stick to. Step-by-step guidance, mindset shifts, and simple budgeting tips.",
		metaTitle: "How to Build a Monthly Budget You Will Actually Stick To",
	},
	"how-to-track-shared-expenses": {
		slug: "how-to-track-shared-expenses",
		path: "/blog/how-to-track-shared-expenses",
		title: "How to Track Shared Expenses With Your Partner or Roommates",
		description:
			"Learn how to track shared expenses fairly with partners or roommates. Discover simple methods, tools, and tips to avoid money conflicts.",
		metaTitle: "How to Track Shared Expenses With Your Partner or Roommates",
	},
	"best-expense-tracking-apps-2025": {
		slug: "best-expense-tracking-apps-2025",
		path: "/blog/best-expense-tracking-apps-2025",
		title: "Best Free Expense Tracking Apps in 2025 (Honest Comparison)",
		description:
			"Compare the best free expense tracking apps in 2025. Honest pros, cons, features, and tips to help you choose the right budgeting tool.",
		metaTitle: "Best Free Expense Tracking Apps in 2025 (Honest Comparison)",
	},
	"why-you-keep-failing-at-budgeting": {
		slug: "why-you-keep-failing-at-budgeting",
		path: "/blog/why-you-keep-failing-at-budgeting",
		title: "Why You Keep Failing at Budgeting (And 7 Simple Fixes That Actually Work)",
		description: "Struggling to stick to a budget? Learn the real reasons budgeting fails and 7 simple fixes that actually work in real life.",
		metaTitle: "Why You Keep Failing at Budgeting (And 7 Simple Fixes That Actually Work)",
	},
};

type SeoMap = Record<BlogKey, Metadata>;

export const blogSeoMetadata: SeoMap = Object.values(blogs).reduce((acc, post) => {
	acc[post.slug] = {
		title: post.metaTitle,
		description: post.description,
		alternates: { canonical: `${SITE}${post.path}` },
		openGraph: {
			title: post.metaTitle,
			description: post.description,
			url: `${SITE}${post.path}`,
			type: "article",
		},
		twitter: {
			card: "summary_large_image",
			title: post.metaTitle,
			description: post.description,
		},
	};
	return acc;
}, {} as SeoMap);

export const blogJsonLd: Record<BlogKey, Record<string, unknown>> = Object.values(blogs).reduce((acc, post) => {
	acc[post.slug] = {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		headline: post.metaTitle,
		description: post.description,
		url: `${SITE}${post.path}`,
		mainEntityOfPage: `${SITE}${post.path}`,
		author: { "@type": "Organization", name: "Expenseo" },
		publisher: {
			"@type": "Organization",
			name: "Expenseo",
			logo: {
				"@type": "ImageObject",
				url: `${SITE}/expenseo-logo.png`,
			},
		},
		datePublished: "2025-01-01",
		dateModified: "2025-01-01",
	};
	return acc;
}, {} as Record<BlogKey, Record<string, unknown>>);

export const blogInternalLinks: Record<BlogKey, string> = {
	"how-to-start-tracking-expenses": `
<ul>
  <li><a href="/blog/expense-categories-to-track">Top 10 Expense Categories Everyone Should Track</a></li>
  <li><a href="/blog/how-to-build-a-monthly-budget">How to Build a Monthly Budget You Will Actually Stick To</a></li>
</ul>`,
	"expense-categories-to-track": `
<ul>
  <li><a href="/blog/how-to-start-tracking-expenses">How to Start Tracking Your Expenses in 2025</a></li>
  <li><a href="/blog/how-to-track-shared-expenses">How to Track Shared Expenses With Your Partner or Roommates</a></li>
</ul>`,
	"how-to-build-a-monthly-budget": `
<ul>
  <li><a href="/blog/how-to-start-tracking-expenses">How to Start Tracking Your Expenses in 2025</a></li>
  <li><a href="/blog/why-you-keep-failing-at-budgeting">Why You Keep Failing at Budgeting (And 7 Simple Fixes)</a></li>
</ul>`,
	"how-to-track-shared-expenses": `
<ul>
  <li><a href="/blog/how-to-build-a-monthly-budget">How to Build a Monthly Budget You Will Actually Stick To</a></li>
  <li><a href="/blog/best-expense-tracking-apps-2025">Best Free Expense Tracking Apps in 2025</a></li>
</ul>`,
	"best-expense-tracking-apps-2025": `
<ul>
  <li><a href="/blog/how-to-start-tracking-expenses">How to Start Tracking Your Expenses in 2025</a></li>
  <li><a href="/blog/why-you-keep-failing-at-budgeting">Why You Keep Failing at Budgeting (And 7 Simple Fixes)</a></li>
</ul>`,
	"why-you-keep-failing-at-budgeting": `
<ul>
  <li><a href="/blog/how-to-build-a-monthly-budget">How to Build a Monthly Budget You Will Actually Stick To</a></li>
  <li><a href="/blog/how-to-track-shared-expenses">How to Track Shared Expenses With Your Partner or Roommates</a></li>
</ul>`,
} as const;
