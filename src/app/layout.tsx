import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FloatingAddButton } from '@/app/_components/fab-add-transaction';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { Toaster } from "react-hot-toast";
import { OutboxSyncListener } from '@/app/_components/outbox-sync-listener';
import { SwUpdateListener } from '@/app/_components/sw-update-listener';
import { NetworkStatusBadge } from '@/app/_components/network-status-badge';
import { OutboxSyncIndicator } from '@/app/_components/outbox-sync-indicator';

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Expenseo ",
    description: "You smart personal expenses tracker app",
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const supabase = await createSupabaseServerComponentClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();
    const isLoggedIn = Boolean(session);

    return (
        <html lang="en" data-theme="light">
            <head>
                <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
                <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
                <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
                <link rel="manifest" href="/site.webmanifest" />
            </head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                {children}
                <OutboxSyncListener />
                <SwUpdateListener />
                <NetworkStatusBadge />
                <OutboxSyncIndicator />
                <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
                <FloatingAddButton visible={isLoggedIn} />
            </body>
        </html>
    );
}
