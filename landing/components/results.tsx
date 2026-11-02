import { DiplomaWall, type Person } from "@/components/diploma-wall";
import diplomas from "@/lib/diplomas.json";
import { ArrowRight } from "lucide-react";

const people = diplomas as Person[];
const all = people.flatMap((p) => p.diplomas);
export const OUR_DIPLOMAS = all.length;
export const TEAM_SEASON = "2025/26";

const wins = (p: Person) =>
	p.diplomas.filter((d) => d.kind === "winner").length;
const wall = [...people].sort(
	(a, b) =>
		b.diplomas.length - a.diplomas.length ||
		wins(b) - wins(a) ||
		b.diplomas[b.diplomas.length - 1].season.localeCompare(
			a.diplomas[a.diplomas.length - 1].season,
		),
);

function NextIsYou({ className = "" }: { className?: string }) {
	return (
		<a
			href="#admissions"
			className={`group inline-flex items-center gap-2 font-semibold text-accent-strong ${className}`}
		>
			Следующий диплом может быть твоим
			<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
		</a>
	);
}

function TeamImg({ className = "" }: { className?: string }) {
	return (
		<img
			src="/photos/team.webp"
			srcSet="/photos/team-sm.webp 735w, /photos/team.webp 1469w"
			sizes="(min-width: 1152px) 1152px, 100vw"
			alt="Сборная Москвы в бордовых куртках с дипломами на ВсОШ"
			width={1469}
			height={471}
			loading="lazy"
			decoding="async"
			className={className}
		/>
	);
}

export function TeamPhoto() {
	return (
		<figure className="tile reveal relative mt-4 overflow-hidden">
			<TeamImg className="aspect-[4/3] w-full object-cover sm:aspect-auto" />
			<figcaption className="px-5 py-4 sm:absolute sm:top-5 sm:left-5 sm:rounded-2xl sm:border sm:border-white/10 sm:bg-[#0b0a0c]/75 sm:px-4 sm:py-3 sm:backdrop-blur-md">
				<div className="font-bold font-display text-base leading-tight sm:text-xl">
					Это мы
				</div>
				<div className="text-white/70 text-xs sm:text-sm">
					сборная {TEAM_SEASON}
				</div>
			</figcaption>
		</figure>
	);
}

export function ResultsWall() {
	return (
		<div className="tile reveal relative z-10 p-6 sm:p-10 lg:p-12">
			<div className="relative grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
				<div>
					<h2 className="font-bold font-display text-3xl tracking-tight sm:text-5xl">
						<span className="text-accent">{OUR_DIPLOMAS}</span> дипломов ВсОШ по
						ИБ
					</h2>
					<p className="mt-4 text-muted sm:text-lg">
						Столько дипломов получили ученики сборной за время существования
						олимпиады.
					</p>
					<NextIsYou className="mt-6" />
				</div>
				<div>
					<DiplomaWall people={wall} />
				</div>
			</div>
		</div>
	);
}
