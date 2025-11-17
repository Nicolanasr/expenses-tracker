declare module "next-pwa" {
	import type { NextConfig } from "next";

	type PWAConfig = {
		dest: string;
		disable?: boolean;
		register?: boolean;
		sw?: string;
		fallbacks?: Record<string, string>;
		runtimeCaching?: unknown[];
	};

	export default function withPWA(config?: PWAConfig): (nextConfig: NextConfig) => NextConfig;
}
