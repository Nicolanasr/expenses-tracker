export type RoadmapEntry = {
    title: string;
    description: string;
    priority: "Must have" | "Should have" | "Nice to have";
};

export const ROADMAP: RoadmapEntry[] = [
    {
        title: "Multi-account and payee support",
        description: "Label each transaction with the account or merchant so you can see balances per account and filter by store.",
        priority: "Must have",
    },
    {
        title: "Recurring transactions & reminders",
        description: "Schedule salary, rent, or subscriptions to auto-log or prompt you to confirm.",
        priority: "Must have",
    },
    {
        title: "Advanced search & saved views",
        description: "Tag transactions and search notes or merchants, then save views beyond presets.",
        priority: "Must have",
    },
    {
        title: "Bulk actions",
        description: "Select multiple entries to edit categories, apply tags, or delete in one go.",
        priority: "Must have",
    },
    {
        title: "Insights & burn rate",
        description: "Monthly vs last month trends, average spend, and projected runway.",
        priority: "Must have",
    },
    {
        title: "Bank file reconciliation",
        description: "Import OFX/CSV with duplicate detection and smart category suggestions.",
        priority: "Must have",
    },
    {
        title: "Audit log with soft delete",
        description: "Track every edit/delete and keep undo/snackbar across the app.",
        priority: "Must have",
    },
    {
        title: "Receipt attachments",
        description: "Upload photos or PDFs per transaction for easy record keeping.",
        priority: "Should have",
    },
    {
        title: "Quick add & shortcuts",
        description: "Floating new-transaction modal on desktop and keyboard shortcuts to log spending fast.",
        priority: "Should have",
    },
    {
        title: "Budget alerts",
        description: "Simple notifications when a category crosses a threshold (e.g. 80% of budget).",
        priority: "Should have",
    },
    {
        title: "Bank sync or pending/cleared workflow",
        description: "Connect to Plaid and friends, or at least manage pending → cleared states for manual recon.",
        priority: "Should have",
    },
    {
        title: "Multi-currency reporting",
        description: "Per-account currencies with FX conversions in reports.",
        priority: "Should have",
    },
    {
        title: "Shared spaces & roles",
        description: "Invite a partner or bookkeeper with specific permissions.",
        priority: "Nice to have",
    },
    {
        title: "Goals and savings buckets",
        description: "Track envelopes or goals and link transactions to goal progress.",
        priority: "Nice to have",
    },
    {
        title: "Custom dashboards",
        description: "Let users design their own widgets/cards so they see just what matters.",
        priority: "Nice to have",
    },
    {
        title: "AI assist",
        description: "Auto-categorise transactions and suggest budgets based on history.",
        priority: "Nice to have",
    },
];
