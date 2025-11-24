import { NextResponse } from "next/server";

import { getAllBlogPosts } from "@/lib/blogs";

export async function GET() {
	try {
		const posts = await getAllBlogPosts();
		return NextResponse.json({ posts });
	} catch (error) {
		console.error("[blog-api] unable to load posts", error);
		return NextResponse.json({ posts: [] }, { status: 200 });
	}
}
