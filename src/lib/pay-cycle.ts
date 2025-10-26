const DAY_MS = 24 * 60 * 60 * 1000;

function parseMonthKey(month: string) {
	const [yearString, monthString] = month.split("-");
	const year = Number(yearString);
	const monthIndex = Number(monthString);
	if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
		throw new Error(`Invalid month key: ${month}`);
	}
	return { year, monthIndex };
}

function clampDay(year: number, monthIndex: number, day: number) {
	const lastDay = new Date(year, monthIndex, 0).getDate();
	return Math.min(Math.max(1, day), lastDay);
}

export function toISODate(date: Date) {
	return date.toISOString().slice(0, 10);
}

export function shiftMonth(month: string, delta: number) {
	const { year, monthIndex } = parseMonthKey(month);
	const date = new Date(year, monthIndex - 1 + delta, 1);
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	return `${y}-${m}`;
}

export function getCycleStartDate(month: string, startDay: number) {
	const { year, monthIndex } = parseMonthKey(month);
	const day = clampDay(year, monthIndex, startDay);
	return new Date(year, monthIndex - 1, day);
}

export function getCycleRange(month: string, startDay: number) {
	const startDate = getCycleStartDate(month, startDay);
	const nextMonthKey = shiftMonth(month, 1);
	const nextStartDate = getCycleStartDate(nextMonthKey, startDay);
	const endInclusive = new Date(nextStartDate.getTime() - DAY_MS);

	return {
		startDate,
		endDateInclusive: endInclusive,
		startISO: toISODate(startDate),
		endISOInclusive: toISODate(endInclusive),
		endISOExclusive: toISODate(nextStartDate),
	};
}

export function currentCycleKeyForDate(date: Date, startDay: number) {
	const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
	const startDate = getCycleStartDate(monthKey, startDay);
	if (date.getTime() >= startDate.getTime()) {
		return monthKey;
	}
	return shiftMonth(monthKey, -1);
}
