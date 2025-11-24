"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import Lightbox from "yet-another-react-lightbox";
import {
    HiOutlineBriefcase,
    HiOutlineBuildingStorefront,
    HiOutlineGlobeAsiaAustralia,
    HiOutlineHomeModern,
    HiOutlineUsers,
    HiOutlineWallet,
} from "react-icons/hi2";
import { ROADMAP } from "@/data/roadmap";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "yet-another-react-lightbox/styles.css";
import { MarketingHeader } from "./marketing-header";

const FEATURE_LIST = [
    {
        title: "Offline-safe logging",
        description: "Record expenses anywhere. Expenseo queues everything and syncs it with undo support once you reconnect.",
        icon: "📡",
    },
    {
        title: "Powerful timeline",
        description: "Group transactions by day, paginate instantly, and keep filters when you share a link.",
        icon: "🗂️",
    },
    {
        title: "Smart budgets",
        description: "Set per-category budgets, copy last month, and open a detail drawer to see spend vs plan.",
        icon: "💡",
    },
    {
        title: "Bulk actions & tags",
        description: "Multi-select to edit categories, apply tags, or archive in seconds.",
        icon: "🧩",
    },
    {
        title: "CSV export + insights",
        description: "Download clean CSVs, view monthly vs last month trends, and track average burn.",
        icon: "📈",
    },
    {
        title: "Future-ready roadmap",
        description: "Recurring transactions, account tagging, attachments, and bank imports are already in motion.",
        icon: "🚀",
    },
];

const LOGOS = [
    { name: "Patio Collective", src: "https://logo.clearbit.com/patio.com", href: "https://patio.com" },
    { name: "Wheelhouse Agency", src: "https://logo.clearbit.com/wheelhouse.io", href: "https://wheelhouse.io" },
    { name: "Grove Collaborative", src: "https://logo.clearbit.com/grovecollaborative.com", href: "https://www.grove.co" },
    { name: "Home Chef Kitchens", src: "https://logo.clearbit.com/homechef.com", href: "https://www.homechef.com" },
    { name: "LimeWire Studios", src: "https://logo.clearbit.com/limewire.com", href: "https://limewire.com" },
    { name: "Foxtrot Markets", src: "https://logo.clearbit.com/foxtrotco.com", href: "https://foxtrotco.com" },
    { name: "Courier Labs", src: "https://logo.clearbit.com/trycourier.com", href: "https://trycourier.com" },
    { name: "Aurora Coffee", src: "https://logo.clearbit.com/auroracoffee.hk", href: "https://auroracoffee.hk" },
    { name: "ZenChef Kitchens", src: "https://logo.clearbit.com/zenchef.com", href: "https://www.zenchef.com" },
    { name: "Fathom Studios", src: "https://logo.clearbit.com/fathom.video", href: "https://fathom.video" },
];

const PERSONAS = [

    {
        title: "Personal budgeters",
        description: "Keep tabs on every coffee, gym fee, or impulse buy and stay under your monthly caps.",
        icon: HiOutlineWallet,
        tag: "Individuals",
        gradientLight: "from-slate-50/80 via-white to-white",
        gradientDark: "from-white/10 via-white/5 to-transparent",
        badgeClass: "bg-slate-100/80 text-slate-700 dark:bg-white/10 dark:text-white",
    },
    {
        title: "Freelancers & contractors",
        description: "Track client reimbursements, mileage, and hardware purchases—even when you’re flying to the next gig.",
        icon: HiOutlineBriefcase,
        tag: "Freelancers",
        gradientLight: "from-orange-50/90 via-white to-white",
        gradientDark: "from-white/10 via-white/5 to-transparent",
        badgeClass: "bg-orange-100/80 text-orange-700 dark:bg-white/10 dark:text-white",
    },
    {
        title: "Creators & mentors",
        description: "Log gear, software subscriptions, and paid sessions, then export tax-ready CSVs.",
        icon: HiOutlineUsers,
        tag: "Creators",
        gradientLight: "from-fuchsia-50/80 via-white to-white",
        gradientDark: "from-white/10 via-white/5 to-transparent",
        badgeClass: "bg-fuchsia-100/80 text-fuchsia-700 dark:bg-white/10 dark:text-white",
    },
    {
        title: "Couples & households",
        description: "Share every grocery, rent, and daycare cost in one view, then copy last month’s plan in a tap.",
        icon: HiOutlineHomeModern,
        tag: "Households",
        gradientLight: "from-rose-50/80 via-white to-white",
        gradientDark: "from-white/10 via-white/5 to-transparent",
        badgeClass: "bg-rose-100/80 text-rose-700 dark:bg-white/10 dark:text-white",
    },
    {
        title: "Shops, cafés & salons",
        description: "Log cash vs card sales, restock suppliers, and keep the register balanced even without Wi-Fi.",
        icon: HiOutlineBuildingStorefront,
        tag: "Retail",
        gradientLight: "from-amber-50/80 via-white to-white",
        gradientDark: "from-white/10 via-white/5 to-transparent",
        badgeClass: "bg-amber-100/80 text-amber-700 dark:bg-white/10 dark:text-white",
    },
    {
        title: "Students & expats abroad",
        description: "Stretch stipends across currencies, capture campus expenses offline, sync later without gaps.",
        icon: HiOutlineGlobeAsiaAustralia,
        tag: "Students",
        gradientLight: "from-cyan-50/80 via-white to-white",
        gradientDark: "from-white/10 via-white/5 to-transparent",
        badgeClass: "bg-cyan-100/80 text-cyan-700 dark:bg-white/10 dark:text-white",
    },
];

const TESTIMONIALS = [
    {
        quote: "Expenseo replaced three spreadsheets and a notes app. I logged a week of travel offline and it synced the moment I landed.",
        author: "Leah M., Product consultant",
        avatar: "https://randomuser.me/api/portraits/women/65.jpg",
    },
    {
        quote: "My partner and I finally agree on budgets. Copying last month and seeing the ‘show more’ drawer keeps us honest.",
        author: "Anthony & Maya, Beta family",
        avatar: "https://randomuser.me/api/portraits/men/32.jpg",
    },
    {
        quote: "Our video team logs payables offline during shoots and reconciles every Monday without losing a beat.",
        author: "Kendra P., Creative Director",
        avatar: "https://randomuser.me/api/portraits/women/52.jpg",
    },
    {
        quote: "Expenseo lets me tag every client and account quickly. Bulk edit saves me hours during month-end close.",
        author: "Carlos A., Fractional CFO",
        avatar: "https://randomuser.me/api/portraits/men/44.jpg",
    },
];


const PRICING_FEATURES = [
    "Offline queue + undo",
    "Budgets & health cards",
    "Saved filters & CSV export",
    "Attachments & receipt inbox",
    "Alerts + scheduled digests",
    "Unlimited presets/views",
    "Multi-currency wallets",
    "Shared workspaces & roles",
    "Recurring transactions",
    "Audit log + undo history",
    "Bank/OFX import",
    "Bank sync (Plaid/etc.)",
    "Goals & savings buckets",
    "Custom dashboards",
    "AI assist (auto categorise)",
];

const ANNUAL_DISCOUNT = 0.25;

const PRICING = [
    {
        name: "Starter",
        monthlyPrice: 0,
        badge: "Free",
        perks: ["Solo usage", "Email support"],
        description: "",
        features: Object.fromEntries(PRICING_FEATURES.map((feature, index) => [feature, index < 3])),
    },
    {
        name: "Growth",
        monthlyPrice: 8,
        badge: "Popular",
        perks: ["Up to 3 collaborators", "Priority chat"],
        description: "",
        features: {
            ...Object.fromEntries(PRICING_FEATURES.map((feature, index) => [feature, index < 9])),
        },
    },
    {
        name: "Team",
        monthlyPrice: 24,
        badge: "Coming next",
        perks: ["Unlimited collaborators", "Account manager"],
        description: "",
        features: Object.fromEntries(PRICING_FEATURES.map((feature) => [feature, true])),
    },
];

const CHANGELOG = [
    {
        title: "Landing revamp",
        date: "Nov 19",
        description: "Showed real screenshots, pricing preview, walkthrough video, roadmap highlights, and FAQ.",
    },
    {
        title: "Budget health card",
        date: "Nov 17",
        description: "Surfaced top budgets on dashboard with a “show more” drawer for deeper insight.",
    },
    {
        title: "Offline queue with undo",
        date: "Nov 15",
        description: "Every transaction now has undo toasts, conflict handling, and sync progress indicators.",
    },
];

const FAQS = [
    { question: "Is there a free tier?", answer: "Yes. During beta, Expenseo is free so you can explore every feature before pricing kicks in." },
    {
        question: "How does offline sync work?",
        answer: "We store every action locally with an undo button. When you reconnect, Expenseo syncs automatically and shows progress (e.g., “Syncing 2/5”).",
    },
    {
        question: "How is data protected?",
        answer: "Only signed-in users can access a workspace. Data stays encrypted in our database and you can clear local cache anytime.",
    },
    {
        question: "Do you support multi-account or bank import?",
        answer: "Multi-account tagging is live today. Bank/OFX import and full sync are on the Team roadmap—join the waitlist and we’ll notify you when it ships.",
    },
    {
        question: "Can I share with my partner or team?",
        answer: "Shared workspaces with roles are in progress. Today, you can invite others under the same account and export CSVs for accounting.",
    },
    { question: "Do you offer support?", answer: "Beta users get direct chat/email access plus a weekly changelog so you know what changed." },
];

const SCREENSHOTS = [
    { src: "/screens/image (2).jpg", alt: "Dashboard overview" },
    { src: "/screens/image (3).jpg", alt: "Transactions filters" },
    { src: "/screens/madkhal-ideas.jpg", alt: "Budget insights" },
];

export function LandingPage() {
    const [blogPosts, setBlogPosts] = useState<
        { slug: string; title: string; excerpt: string; date: string; readingTime: string; tags: string[] }[]
    >([]);
    const [theme, setTheme] = useState<"light" | "dark">("light");
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");

    useEffect(() => {
        if (typeof document === "undefined") return;
        const tmpTheme: "light" | "dark" = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTheme(tmpTheme);
    }, []);

    useEffect(() => {
        const fetchPosts = async () => {
            try {
                const res = await fetch("/api/blog", { cache: "no-store" });
                if (!res.ok) return;
                const payload = await res.json();
                setBlogPosts(payload.posts ?? []);
            } catch (error) {
                console.error("[blog] unable to load posts", error);
            }
        };
        fetchPosts();
    }, []);

    useEffect(() => {
        if (typeof document === "undefined") return;
        document.documentElement.dataset.theme = theme;
    }, [theme]);

    const analytics = useMemo(
        () => [
            { label: "Offline entries synced", value: "24,870", change: "+1,240 this week" },
            { label: "Budgets managed", value: "3,210", change: "+220 new" },
            { label: "CSV exports", value: "980", change: "in the last month" },
        ],
        [],
    );

    const getPlanPricing = (plan: (typeof PRICING)[number]) => {
        if (plan.monthlyPrice === 0) {
            return {
                primary: "$0",
                secondary: "per month",
                savings: null,
            };
        }
        if (billingPeriod === "monthly") {
            return {
                primary: `$${plan.monthlyPrice}`,
                secondary: "per month",
                savings: null,
            };
        }
        const yearly = plan.monthlyPrice * 12 * (1 - ANNUAL_DISCOUNT);
        const effectiveMonthly = yearly / 12;
        return {
            primary: `$${effectiveMonthly.toFixed(2)}`,
            secondary: `per month · billed $${yearly.toFixed(0)}/yr`,
            savings: `Save ${Math.round(ANNUAL_DISCOUNT * 100)}%`,
        };
    };

    const isLight = theme === "light";
    const rootClass = isLight
        ? "bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900"
        : "bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white";

    const cardClass = isLight
        ? "rounded-[32px] border border-slate-200 bg-white text-slate-900 shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
        : "rounded-[32px] border border-white/10 bg-white/5 text-white backdrop-blur shadow-[0_20px_50px_rgba(0,0,0,0.35)]";

    return (
        <div className={`space-y-16 pb-20 transition-colors duration-500 ${rootClass}`}>
            <MarketingHeader />

            <section id="hero" className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-300/30 via-transparent to-emerald-300/30 dark:from-indigo-700/40 dark:via-transparent dark:to-emerald-500/40" />
                <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-6 py-20 lg:flex-row lg:items-center lg:px-10">
                    <div className="flex-1 space-y-6 text-center lg:text-left">
                        <p className="text-xs uppercase tracking-[0.4em] text-indigo-500 dark:text-indigo-300">Expenseo</p>
                        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
                            Offline entries, budget health, and shared filters—all in the workspace you already use.
                        </h1>
                        <p className="text-base text-slate-600 dark:text-slate-200">
                            Queue expenses without signal, keep the homepage and transactions page fast with server-side pagination, and reuse the same presets across every view.
                            Every component showcased below actually ships in the app.
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-start">
                            <Link href="/auth/sign-up" className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500">
                                Create a free workspace
                            </Link>
                            <Link href="/auth/sign-in" className="rounded-full border border-indigo-100 px-6 py-3 text-sm text-indigo-600 hover:bg-indigo-50 dark:border-white/30 dark:text-white dark:hover:bg-white/10">
                                Sign in
                            </Link>
                        </div>
                        <div className="grid gap-4 rounded-3xl border border-slate-200/70 bg-white/70 px-4 py-4 text-left dark:border-white/20 dark:bg-white/10 sm:grid-cols-3">
                            {analytics.map((stat) => (
                                <div key={stat.label}>
                                    <p className="text-xl font-semibold text-slate-900 dark:text-white">{stat.value}</p>
                                    <p className="text-xs text-slate-600 dark:text-white/70">{stat.label}</p>
                                    <p className="text-xs text-emerald-600 dark:text-emerald-300">{stat.change}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className={`${cardClass} flex-1 space-y-4 p-6`}>
                        <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">Transactions stay synced across pages.</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                                Homepage widgets, the transactions list, and budgets all read from the same cached data and honor your saved filters.
                            </p>
                        </div>
                        <div className="space-y-3 rounded-2xl bg-white/70 p-4 text-sm font-medium text-slate-700 shadow-inner dark:bg-white/10 dark:text-slate-200">
                            {[
                                { label: "Groceries · $42.18", meta: "Wallet · logged offline" },
                                { label: "Studio rent · $1,200", meta: "Bank transfer · recurring" },
                                { label: "Salary · +$3,800", meta: "Payroll · shared preset" },
                                { label: "Coffee · $5.30", meta: "Card · tagged on mobile" },
                            ].map((row, index) => (
                                <div key={row.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 dark:border-white/5 dark:bg-white/5">
                                    <div>
                                        <p>{row.label}</p>
                                        <p className="text-xs text-slate-600">{row.meta}</p>
                                    </div>
                                    <span className="text-xs text-emerald-600 dark:text-emerald-300">{["Sep 12", "Sep 11", "Sep 11", "Sep 10"][index]}</span>
                                </div>
                            ))}
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                            <p className="font-semibold text-slate-800 dark:text-white">Budget health snapshot</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300">Matches the “Budget health” card further below—top categories by % used with a show-more drawer.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section id="trusted" className="mx-auto ">
                <div className="border border-slate-200/60 bg-white px-6 lg:px-10 py-8  dark:border-white/10 dark:bg-white/5">
                    <p className="text-center text-xs font-semibold uppercase tracking-[0.4em] text-indigo-400">Trusted by operations & finance teams</p>
                    <div className="mt-6">
                        <Swiper spaceBetween={24} slidesPerView={2} breakpoints={{ 640: { slidesPerView: 4 }, 1024: { slidesPerView: 8 } }} autoplay={{ delay: 2200 }} loop modules={[Autoplay]} className="py-4">
                            {LOGOS.map((logo) => (
                                <SwiperSlide key={logo.name}>
                                    <a href={logo.href} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-3 rounded-3xl border border-slate-100 bg-white px-5 py-4 shadow-sm dark:border-white/20 dark:bg-white/5">
                                        <Image src={logo.src} alt={logo.name} width={160} height={50} className="h-12 w-auto object-contain" />
                                        <p className="text-xs font-semibold text-slate-600 dark:text-white">{logo.name}</p>
                                    </a>
                                </SwiperSlide>
                            ))}
                        </Swiper>
                    </div>
                </div>
            </section>

            <section id="features" className="mx-auto max-w-6xl px-6 lg:px-10">
                <div className={`${isLight ? "rounded-4xl border border-slate-200 bg-white shadow-xl" : "rounded-4xl border border-white/10 bg-white/5"} space-y-8 px-6 py-10`}>
                    <div className="space-y-2 text-center">
                        <p className="text-xs uppercase tracking-[0.4em] text-indigo-400">Feature tour</p>
                        <h2 className="text-3xl font-semibold">What you can do inside Expenseo</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-300">Every component below is live today.</p>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-3">
                        {FEATURE_LIST.map((feature) => (
                            <div key={feature.title} className={`${cardClass} p-6`}>
                                <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-2xl text-indigo-600 dark:bg-white/10 dark:text-white">{feature.icon}</span>
                                <h3 className="text-xl font-semibold">{feature.title}</h3>
                                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="budgets" className="mx-auto flex max-w-6xl flex-col gap-8 px-6 lg:flex-row lg:px-10">
                <div className={`${cardClass} flex-1 p-6`}>
                    <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">Budgets and cash flow</p>
                    <div className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-200">
                        {["Groceries", "Mobility", "Subscriptions", "Learning"].map((category, index) => (
                            <div key={category} className="space-y-2 rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                                <div className="flex items-center justify-between">
                                    <p className="font-semibold text-slate-800 dark:text-white">{category}</p>
                                    <span className="text-xs text-slate-600">Budget ${(index + 1) * 250}</span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-100 dark:bg-white/10">
                                    <div className="h-full rounded-full bg-linear-to-r from-emerald-400 to-emerald-500" style={{ width: `${55 + index * 12}%` }} />
                                </div>
                                <p className="text-xs text-slate-600">Spent {40 + index * 8}% · remaining ${(index + 1) * 120}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div className={`${cardClass} flex-1 p-6`}>
                    <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">Roadmap highlights</p>
                    <div className="mt-4 grid gap-4 text-sm text-slate-600 dark:text-slate-200">
                        {ROADMAP.slice(0, 4).map((entry, index) => (
                            <div key={entry.title} className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                                <div className="flex items-center justify-between text-xs text-slate-600">
                                    <span>{entry.priority}</span>
                                    <span>0{index + 1}</span>
                                </div>
                                <p className="mt-2 text-base font-semibold text-slate-800 dark:text-white">{entry.title}</p>
                                <p>{entry.description}</p>
                            </div>
                        ))}
                    </div>
                    <Link href="/roadmap" className="mt-4 inline-flex text-sm font-semibold text-indigo-600 underline underline-offset-4 dark:text-indigo-200">
                        See the full roadmap →
                    </Link>
                </div>
            </section>

            <section className="mx-auto max-w-6xl space-y-4 px-6 lg:px-10" id="walkthrough">
                <p className="text-center text-xs uppercase tracking-[0.3em] text-indigo-400">Walkthrough</p>
                <p className="text-center text-sm text-slate-600 dark:text-slate-200">Watch the dashboard, budgets, and offline queue in action.</p>
                <div className={`${cardClass} overflow-hidden`}>
                    <video controls poster="/expenseo-logo-removebg-preview.png" className="w-full rounded-4xl">
                        <source src="https://samplelib.com/lib/preview/mp4/sample-5s.mp4" type="video/mp4" />
                    </video>
                </div>
                <p className="text-center text-xs uppercase tracking-[0.3em] text-indigo-400">Screenshots</p>
                <div className="relative">
                    <Swiper
                        spaceBetween={16}
                        slidesPerView={1}
                        breakpoints={{ 640: { slidesPerView: 2 }, 1024: { slidesPerView: 3 } }}
                        modules={[Autoplay]}
                        autoplay={{ delay: 3500 }}
                        loop
                    >
                        {SCREENSHOTS.map((shot, index) => (
                            <SwiperSlide key={shot.src}>
                                <button type="button" onClick={() => setLightboxIndex(index)} className="block h-full w-full">
                                    <Image src={shot.src} alt={shot.alt} width={640} height={360} className="h-60 w-full rounded-3xl border border-slate-200 object-cover dark:border-white/10" />
                                </button>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                    <Lightbox open={lightboxIndex !== null} close={() => setLightboxIndex(null)} index={lightboxIndex ?? 0} slides={SCREENSHOTS} />
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-6 lg:px-10" id="personas">
                <div className={`${isLight ? "rounded-4xl border border-slate-200 bg-white shadow-xl" : "rounded-4xl border border-white/10 bg-white/5"} grid gap-10 px-6 py-10 lg:grid-cols-[1.05fr_1.35fr]`}>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">Expenseo adapts</p>
                            <h2 className="text-3xl font-semibold">Different people, same clarity.</h2>
                            <p className="text-sm text-slate-600 dark:text-slate-200">
                                Freelancers, parents, shop owners, and community treasurers all want the same thing: a place to track money that never flakes, even without signal.
                            </p>
                        </div>
                        <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-200">
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-3 rounded-full inline-block bg-black" />
                                Offline queue means you can swipe a card reader, hop on a plane, and catch up later without losing a transaction.
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-3 rounded-full inline-block bg-black " />
                                Saved filters + CSV export let you send partners, clients, or boards exactly what they need in seconds.
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="mt-1 h-2 w-3 rounded-full inline-block bg-black " />
                                Budget limits, alerts, and undo give first-time trackers the same confidence as seasoned operators.
                            </li>
                        </ul>
                        <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                            “We run school fundraisers in gym basements with zero service. Expenseo queues every sale and syncs when we’re back on Wi-Fi.” — Layla, community lead
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
                        {PERSONAS.map((persona) => (
                            <div
                                key={persona.title}
                                className={`rounded-3xl p-5 shadow-lg shadow-slate-900/5 backdrop-blur dark:shadow-black/30 bg-gradient-to-br ${isLight ? persona.gradientLight : persona.gradientDark
                                    }`}
                            >
                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${persona.badgeClass}`}>{persona.tag}</span>
                                <div className="mt-4 flex items-center gap-3">
                                    <persona.icon className="h-12 w-12 rounded-2xl bg-white/80 p-3 text-emerald-600 shadow-sm dark:bg-white/10 dark:text-white" />
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">{persona.title}</h3>
                                </div>
                                <p className="mt-3 text-sm text-slate-600 dark:text-slate-200">{persona.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>


            <section id="pricing" className="mx-auto max-w-6xl space-y-6 px-6 lg:px-10">
                <div className="space-y-2 text-center">
                    <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">Pricing Preview</p>
                    <h2 className="text-3xl font-semibold">Choose the plan that matches your workflow.</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-200">Free tier keeps the essentials; paid tiers unlock collaboration, automation, and bank-ready workflows.</p>
                    <div className="mt-4 inline-flex items-center rounded-full border border-slate-200 p-1 text-xs font-semibold dark:border-white/20">
                        {(["monthly", "annual"] as const).map((period) => (
                            <button
                                key={period}
                                type="button"
                                onClick={() => setBillingPeriod(period)}
                                className={`rounded-full px-4 py-2 transition ${billingPeriod === period
                                    ? "bg-indigo-600 text-white"
                                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                                    }`}
                            >
                                {period === "monthly" ? "Monthly billing" : `Annual billing (save ${ANNUAL_DISCOUNT * 100}%)`}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm text-slate-600 dark:text-slate-200">
                        <thead>
                            <tr>
                                <th className="pb-4 text-left text-xs uppercase tracking-[0.3em] text-indigo-400">Features</th>
                                {PRICING.map((plan) => {
                                    const pricing = getPlanPricing(plan);
                                    return (
                                        <th key={plan.name} className="pb-4 text-center">
                                            <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-400">{plan.badge}</div>
                                            <p className="mt-1 text-xl font-semibold">{plan.name}</p>
                                            <p className="text-3xl font-bold text-slate-900 dark:text-white">{pricing.primary}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{pricing.secondary}</p>
                                            {pricing.savings && <p className="text-xs text-emerald-500">{pricing.savings}</p>}
                                            <p className="mt-2 text-xs text-emerald-500">{plan.perks.join(" · ")}</p>
                                            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{plan.description}</p>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {PRICING_FEATURES.map((feature) => (
                                <tr key={feature} className="border-t border-slate-200 dark:border-white/10">
                                    <td className="py-3 font-medium text-slate-800 dark:text-white">{feature}</td>
                                    {PRICING.map((plan) => (
                                        <td key={`${plan.name}-${feature}`} className="py-3 text-center">
                                            {plan.features[feature] ? (
                                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">✓</span>
                                            ) : (
                                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">×</span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-6 lg:px-10">
                <div className="space-y-2 text-center">
                    <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">Testimonials</p>
                    <h2 className="text-3xl font-semibold">People already shipping with Expenseo</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-200">Real words from early adopters.</p>
                </div>
                <div className="mt-6">
                    <Swiper
                        spaceBetween={20}
                        slidesPerView={1}
                        breakpoints={{ 768: { slidesPerView: 2 } }}
                        autoplay={{ delay: 4000 }}
                        navigation
                        pagination={{ clickable: true }}
                        modules={[Autoplay, Navigation, Pagination]}
                        loop
                        className="testimonial-swiper py-8"
                    >
                        {TESTIMONIALS.map((testimonial) => (
                            <SwiperSlide key={testimonial.author}>
                                <div className={`${cardClass} h-full p-6`}>
                                    <div className="flex items-center gap-3">
                                        <Image src={testimonial.avatar} alt={testimonial.author} width={48} height={48} className="h-12 w-12 rounded-full object-cover" />
                                        <p className="text-sm text-slate-600 dark:text-slate-200">{testimonial.author}</p>
                                    </div>
                                    <p className="mt-3 text-base text-slate-800 dark:text-slate-100">{testimonial.quote}</p>
                                </div>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-6 lg:px-10">
                <div className="space-y-2 text-center">
                    <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">Built this week</p>
                    <h2 className="text-3xl font-semibold">We ship fast and in the open.</h2>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {CHANGELOG.map((entry) => (
                        <div key={entry.title} className={`${cardClass} p-4 text-sm text-slate-600 dark:text-slate-200`}>
                            <div className="flex items-center justify-between text-xs text-slate-600">
                                <span>{entry.date}</span>
                                <span className="text-emerald-600 dark:text-emerald-300">Shipped</span>
                            </div>
                            <p className="mt-2 text-base font-semibold text-slate-800 dark:text-white">{entry.title}</p>
                            <p>{entry.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section id="blog" className="mx-auto max-w-6xl rounded-4xl border border-slate-200 bg-white/80 px-6 py-10 shadow-lg lg:px-10 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">Blog</p>
                        <h2 className="text-3xl font-semibold">Latest from the team</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-200">Offline-first builds, recurring automation, and smarter budgeting.</p>
                    </div>
                    <Link href="/blog" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
                        See all posts
                    </Link>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {blogPosts.slice(0, 3).map((post) => (
                        <Link
                            key={post.slug}
                            href={`/blog/${post.slug}`}
                            className="group flex flex-col gap-2 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-white/5"
                        >
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-300">
                                <span>
                                    {new Date(post.date).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                    })}
                                </span>
                                <span>•</span>
                                <span>{post.readingTime}</span>
                            </div>
                            <h3 className="text-base font-semibold text-slate-900 transition group-hover:text-indigo-600 dark:text-white">
                                {post.title}
                            </h3>
                            <p className="text-sm text-slate-600 line-clamp-3 dark:text-slate-200">{post.excerpt}</p>
                            <div className="mt-auto flex flex-wrap gap-2">
                                {post.tags.slice(0, 2).map((tag) => (
                                    <span
                                        key={tag}
                                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-100"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            <section id="faq" className="mx-auto max-w-6xl px-6 lg:px-10">
                <div className="space-y-2 text-center">
                    <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">FAQ</p>
                    <h2 className="text-3xl font-semibold">Questions about privacy, pricing, or offline mode?</h2>
                </div>
                <div className="mt-6 space-y-4 rounded-4xl border border-slate-200 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-white/5">
                    {FAQS.map((faq) => (
                        <div key={faq.question} className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0 dark:border-white/10">
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">{faq.question}</p>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">{faq.answer}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mx-auto max-w-4xl rounded-4xl border border-slate-200 bg-white px-6 py-14 text-center shadow-lg lg:px-10 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">Stay in the loop</p>
                <h2 className="mt-3 text-3xl font-semibold">Get roadmap drops + invites.</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">One email per month with new launches, walkthroughs, and beta openings. No spam.</p>
                <form className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <input type="email" required placeholder="you@expenseo.online" className="h-12 flex-1 rounded-full border border-slate-200 px-4 text-sm focus:border-indigo-500 dark:border-white/20 dark:bg-transparent dark:text-white" />
                    <button className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500">Join waitlist</button>
                </form>
            </section>
            <style jsx>{`
                .testimonial-swiper :global(.swiper-button-next),
                .testimonial-swiper :global(.swiper-button-prev) {
                    width: 42px;
                    height: 42px;
                    border-radius: 9999px;
                    background: #ffffff;
                    color: #0f172a;
                    border: 1px solid rgba(15, 23, 42, 0.08);
                    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
                    top: 38%;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }

                .testimonial-swiper :global(.swiper-button-next::after),
                .testimonial-swiper :global(.swiper-button-prev::after) {
                    font-size: 14px;
                    font-weight: 600;
                }

                .testimonial-swiper :global(.swiper-button-next:hover),
                .testimonial-swiper :global(.swiper-button-prev:hover) {
                    transform: translateY(-1px);
                }

                .testimonial-swiper :global(.swiper-pagination-bullet-active) {
                    background: #4f46e5;
                }
            `}</style>
        </div>
    );
}
