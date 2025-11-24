import Link from "next/link";
import Image from "next/image";

import { getAllBlogPosts } from "@/lib/blogs";
import { MarketingHeader } from "@/app/_components/marketing-header";

export const dynamic = "force-dynamic";

export default async function BlogIndexPage() {
	const posts = await getAllBlogPosts();
	return (
		<div className="min-h-screen bg-slate-50">
			<MarketingHeader />
			<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8">
				<header className="flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Blog</p>
                    <h1 className="text-3xl font-bold text-slate-900">Product updates & playbooks</h1>
                    <p className="text-slate-600">
                        How we build Expenseo: offline-first patterns, recurring automation, budgeting with multi-accounts, and more.
                    </p>
				</header>

				<section className="grid gap-6 md:grid-cols-3">
					{posts.map((post) => (
						<Link
							key={post.slug}
							href={`/blog/${post.slug}`}
							className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
						>
                            <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                                <Image
                                    src={post.heroImage}
                                    alt={post.title}
                                    fill
                                    className="object-cover transition duration-500 group-hover:scale-105"
                                    sizes="(max-width: 768px) 100vw, 33vw"
                                />
                            </div>
                            <div className="flex flex-1 flex-col gap-3 p-4">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span>{new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                                    <span>•</span>
                                    <span>{post.readingTime}</span>
                                </div>
                                <h2 className="text-lg font-semibold text-slate-900">{post.title}</h2>
                                <p className="text-sm text-slate-600 line-clamp-3">{post.excerpt}</p>
                                <div className="mt-auto flex flex-wrap gap-2">
                                    {post.tags.map((tag) => (
                                        <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </Link>
                    ))}
                </section>
            </main>
        </div>
    );
}
