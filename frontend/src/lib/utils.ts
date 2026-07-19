import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function getCtfdDomain(): string {
	return "ctfd.infosec.moscow";
}

/**
 * Parses a server timestamp into epoch milliseconds, always interpreting it as
 * UTC. The backend serializes `DateTime<Utc>` with a `Z`, but `new Date()` on a
 * timezone-less string (e.g. "2026-07-19T12:00:00") silently falls back to the
 * viewer's *local* time — which would make an exam deadline off by the viewer's
 * UTC offset (an eastern-timezone student's exam would end early). Appending a
 * `Z` when no offset is present guarantees UTC and is a no-op for the strings
 * the backend already sends. Returns `NaN` for unparseable input.
 */
export function parseServerDateMs(value: string | null | undefined): number {
	if (!value) return Number.NaN;
	const hasTimezone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value.trim());
	return new Date(hasTimezone ? value : `${value}Z`).getTime();
}

export function getPointsPlural(amount: number): string {
	const lastDigit = amount % 10;
	const lastTwo = amount % 100;

	if (lastTwo >= 11 && lastTwo <= 14) {
		return "points_other";
	}

	switch (lastDigit) {
		case 1:
			return "points_one";
		case 2:
		case 3:
		case 4:
			return "points_few";
		default:
			return "points_other";
	}
}
