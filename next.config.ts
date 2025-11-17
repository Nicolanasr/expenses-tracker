import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
	reactStrictMode: true,
};

const makeConfig = withPWA({
	dest: "public",
	disable: process.env.NODE_ENV === "development",
	register: true,
	sw: "service-worker.js",
	fallbacks: {
		document: "/offline",
	},
	runtimeCaching: [
		{
			urlPattern: /^https?.*\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico|webp|avif)$/i,
			handler: "CacheFirst",
			options: {
				cacheName: "static-assets",
				expiration: {
					maxEntries: 100,
					maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
				},
			},
		},
		{
			urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/api/"),
			handler: "NetworkFirst",
			method: "GET",
			options: {
				cacheName: "api-data",
				networkTimeoutSeconds: 3,
				expiration: {
					maxEntries: 50,
					maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
				},
			},
		},
		{
			urlPattern: ({ request }: { request: Request }) => request.destination === "document",
			handler: "NetworkFirst",
			options: {
				cacheName: "pages",
				networkTimeoutSeconds: 3,
				expiration: {
					maxEntries: 50,
					maxAgeSeconds: 60 * 60 * 24 * 14, // 14 days
				},
			},
		},
	],
});

export default makeConfig(nextConfig);
