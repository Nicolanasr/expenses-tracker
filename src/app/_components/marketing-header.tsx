/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HiOutlineSun, HiOutlineMoon } from "react-icons/hi2";

const NAV_LINKS = [
    { label: "Features", href: "#features" },
    { label: "Budgets", href: "#budgets" },
    { label: "Walkthrough", href: "#walkthrough" },
    { label: "Personas", href: "#personas" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
];

export function MarketingHeader() {
    const [theme, setTheme] = useState<"light" | "dark">("light");

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        if (typeof document === "undefined") return;
        console.log(theme)
        document.documentElement.dataset.theme = theme;
    }, [theme]);

    return (

        <header className="mb-0 sticky top-0 z-50 border-b border-slate-200 bg-white/95 text-slate-900 backdrop-blur supports-backdrop-filter:bg-white/80 dark:border-white/10 dark:bg-slate-950/80 dark:text-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 text-sm lg:px-10">
                <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-600 dark:bg-white dark:text-white ">
                        <Image src="/expenseo-logo-removebg-preview.png" height={35} width={35} alt="expenseo logo" />
                    </span>
                    Expenseo
                </Link>
                <nav className="hidden items-center gap-6 text-slate-600 dark:text-slate-300 lg:flex">
                    {NAV_LINKS.map((link) => (
                        <a key={link.href} href={link.href} className="hover:text-indigo-600 dark:hover:text-white">
                            {link.label}
                        </a>
                    ))}
                </nav>
                <div className="flex items-center gap-3 lg:flex">
                    <button
                        type="button"
                        onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
                        className="hidden items-center justify-center rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10 lg:inline-flex"
                        aria-label={theme === "light" ? "Enable dark mode" : "Enable light mode"}
                    >
                        {theme === "light" ? <HiOutlineMoon className="h-4 w-4" /> : <HiOutlineSun className="h-4 w-4" />}
                    </button>
                    <Link href="/auth/sign-in" className="hidden rounded-full border border-slate-200 px-4 py-2 text-slate-600 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10 lg:inline-flex">
                        Sign in
                    </Link>
                    <Link href="/auth/sign-up" className="hidden rounded-full bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 lg:inline-flex">
                        Get started
                    </Link>
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen((prev) => !prev)}
                        className="inline-flex items-center rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10 lg:hidden"
                    >
                        {mobileMenuOpen ? "Close" : "Menu"}
                    </button>
                </div>
            </div>
            {mobileMenuOpen && (
                <div className="border-t border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-lg dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 lg:hidden">
                    <div className="flex flex-col gap-4">
                        {NAV_LINKS.map((link) => (
                            <a
                                key={link.href}
                                href={link.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className="font-semibold hover:text-indigo-600 dark:hover:text-white"
                            >
                                {link.label}
                            </a>
                        ))}
                        <hr className="border-slate-200 dark:border-white/10" />
                        <button
                            type="button"
                            onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
                        >
                            {theme === "light" ? (
                                <>
                                    <HiOutlineMoon className="h-4 w-4" /> Enable dark mode
                                </>
                            ) : (
                                <>
                                    <HiOutlineSun className="h-4 w-4" /> Enable light mode
                                </>
                            )}
                        </button>
                        <Link href="/auth/sign-in" className="rounded-full border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10">
                            Sign in
                        </Link>
                        <Link href="/auth/sign-up" className="rounded-full bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-indigo-500">
                            Get started
                        </Link>
                    </div>
                </div>
            )}
        </header>
    );
}
