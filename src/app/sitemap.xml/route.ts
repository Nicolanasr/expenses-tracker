import { getAllBlogPosts } from "@/lib/blogs";

const SITE = "https://expenseo.online";

export async function GET() {
	const staticRoutes = ["/", "/blog"];
	const blogPosts = await getAllBlogPosts();

	const urls = [
		...staticRoutes.map((path) => `<url><loc>${SITE}${path}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`),
		...blogPosts.map(
			(post) =>
				`<url><loc>${SITE}${
					post.slug.startsWith("/") ? post.slug : `/blog/${post.slug}`
				}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`
		),
	].join("");

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

	return new Response(body, {
		status: 200,
		headers: {
			"Content-Type": "application/xml",
		},
	});
}
