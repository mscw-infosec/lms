import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
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
