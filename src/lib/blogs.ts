import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";

export type BlogPost = {
	slug: string;
	title: string;
	date: string;
	excerpt: string;
	readingTime: string;
	tags: string[];
	heroImage: string;
	contentHtml: string;
};

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

async function loadMarkdownFile(slug: string) {
	const filePath = path.join(BLOG_DIR, `${slug}.md`);
	const raw = await fs.readFile(filePath, "utf8");
	return raw;
}

export async function getAllBlogPosts(): Promise<BlogPost[]> {
	const files = await fs.readdir(BLOG_DIR);
	const posts: BlogPost[] = [];
	for (const file of files) {
		if (!file.endsWith(".md")) continue;
		const slug = file.replace(/\.md$/, "");
		const raw = await fs.readFile(path.join(BLOG_DIR, file), "utf8");
		const { data, content } = matter(raw);
		const contentHtml = marked.parse(content);
		posts.push({
			slug,
			title: data.title ?? slug,
			date: data.date ?? "",
			excerpt: data.excerpt ?? "",
			readingTime: data.readingTime ?? "",
			tags: Array.isArray(data.tags) ? data.tags : [],
			heroImage: data.heroImage ?? "/images/blog/default.jpg",
			contentHtml: typeof contentHtml === "string" ? contentHtml : "",
		});
	}
	return posts.sort((a, b) => (a.date > b.date ? -1 : 1));
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
	try {
		const raw = await loadMarkdownFile(slug);
		const { data, content } = matter(raw);
		const contentHtml = marked.parse(content);
		return {
			slug,
			title: data.title ?? slug,
			date: data.date ?? "",
			excerpt: data.excerpt ?? "",
			readingTime: data.readingTime ?? "",
			tags: Array.isArray(data.tags) ? data.tags : [],
			heroImage: data.heroImage ?? "/images/blog/default.jpg",
			contentHtml: typeof contentHtml === "string" ? contentHtml : "",
		};
	} catch {
		return null;
	}
}
