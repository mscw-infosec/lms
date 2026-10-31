export const SHIELD_PATH =
	"M12 2.3C13.9 2.5 15.6 4.4 19 4.4V11.2C19 17.7 15.6 20.2 12 22C8.4 20.2 5 17.7 5 11.2V4.4C8.4 4.4 10.1 2.5 12 2.3Z";

export function Logo({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden="true">
			<path
				d={SHIELD_PATH}
				fill="var(--accent-soft)"
				stroke="var(--accent)"
				strokeWidth="2.4"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
