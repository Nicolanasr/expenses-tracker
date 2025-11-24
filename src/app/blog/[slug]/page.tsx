import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarketingHeader } from "@/app/_components/marketing-header";
import { getBlogPostBySlug } from "@/lib/blogs";
import { blogJsonLd, blogSeoMetadata, blogInternalLinks } from "@/lib/blog-seo";
import parse from "html-react-parser";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	return blogSeoMetadata[slug as keyof typeof blogSeoMetadata] ?? {};
}

type Params = {
	params: Promise<{ slug: string }>;
};

export default async function BlogPostPage({ params }: Params) {
	const resolved = await params;
	const post = await getBlogPostBySlug(resolved.slug);

	if (!post) {
		notFound();
	}
	const jsonLd = blogJsonLd[resolved.slug as keyof typeof blogJsonLd];
	const internalLinks = blogInternalLinks[resolved.slug as keyof typeof blogInternalLinks] ?? "";

    return (
        <div className="min-h-screen bg-slate-50">
            <MarketingHeader />
            <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8">
                <nav className="text-sm text-slate-500">
                    <Link href="/" className="text-indigo-600 hover:underline">
                        Home
                    </Link>{" "}
                    /{" "}
                    <Link href="/blog" className="text-indigo-600 hover:underline">
                        Blog
                    </Link>{" "}
                    / <span className="text-slate-700">{post.title}</span>
                </nav>

                <header className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        <span>•</span>
                        <span>{post.readingTime}</span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">{post.title}</h1>
                    <div className="flex flex-wrap gap-2">
                        {post.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                {tag}
                            </span>
                        ))}
                    </div>
                </header>

				<div className="relative h-64 w-full overflow-hidden rounded-3xl bg-slate-100 shadow">
					<Image src={post.heroImage} alt={post.title} fill className="object-cover" sizes="100vw" />
				</div>

				<article className="blog-content">{parse(post.contentHtml)}</article>

				{internalLinks ? (
					<section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
						<h3 className="mb-2 text-base font-semibold text-slate-900">Keep reading</h3>
						<div className="text-sm text-slate-700 [&_a]:text-indigo-600 [&_a]:hover:underline">
							{parse(internalLinks)}
						</div>
					</section>
				) : null}

				<div className="flex items-center justify-between border-t border-slate-200 pt-4 text-sm text-slate-600">
					<Link href="/blog" className="text-indigo-600 hover:underline">
						← Back to blog
					</Link>
					<span>Happy budgeting!</span>
				</div>
			</main>
			{jsonLd ? (
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
				/>
			) : null}
		</div>
	);
}
