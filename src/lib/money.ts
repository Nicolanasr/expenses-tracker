export const toCents = (value: number) => Math.round(value * 100);
export const fromCents = (value?: number | null) => ((value ?? 0) / 100).toFixed(2);
