export async function GET() {
	const body = `User-agent: *
Allow: /

Sitemap: https://expenseo.online/sitemap.xml
`;

	return new Response(body, {
		status: 200,
		headers: {
			"Content-Type": "text/plain",
		},
	});
}
