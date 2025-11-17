export const dynamic = "force-static";

export default function OfflinePage() {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center text-slate-700">
			<div className="max-w-md space-y-3">
				<h1 className="text-2xl font-semibold text-slate-900">You’re offline</h1>
				<p className="text-sm text-slate-500">
					Reconnect to sync the latest budgets and transactions. Any changes you make while offline will
					sync automatically when you’re back online.
				</p>
				<p className="text-xs text-slate-400">You can still browse cached pages from your last visit.</p>
			</div>
		</main>
	);
}
