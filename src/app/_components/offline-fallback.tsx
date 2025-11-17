"use client";

export function OfflineFallback({ title = "Looks like you're offline", message = "Reconnect to load your data. Any changes you make while offline will sync when you're back online." }: { title?: string; message?: string }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
            <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="mt-2 text-sm text-slate-600">{message}</p>
            </div>
        </div>
    );
}
