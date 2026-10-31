"use client";

import { useEffect, useRef, useState } from "react";

export type Diploma = {
	season: string;
	kind: "winner" | "prize";
	grade: number;
	school: string;
	/** set when the student wrote the olympiad for an older grade */
	studyGrade?: number;
};
export type Person = { name: string; diplomas: Diploma[] };

const STEP = 3; // px each older diploma peeks out of the stack
const CARD_W = 264;

// gold and silver diplomas
const face = {
	winner: "from-[#f6d77e] to-[#a8741a]",
	prize: "from-[#eef0f3] to-[#868c96]",
};

// gold and silver covers
const cover = {
	winner:
		"bg-[linear-gradient(135deg,#fff3c4_0%,#f5cf62_28%,#d9a23a_55%,#a8731c_80%,#7d5210_100%)] shadow-[inset_0_0_0_1px_rgb(255_240_190/0.6),0_0_10px_-2px_rgb(245_190_80/0.55),0_1px_3px_rgb(0_0_0/0.5)]",
	prize:
		"bg-gradient-to-br from-[#a81b2e] to-[#560914] shadow-[inset_0_0_0_1px_rgb(220_224_230/0.45),inset_0_1px_0_1px_rgb(255_255_255/0.08),0_1px_3px_rgb(0_0_0/0.5)]",
};
const stamp = { winner: "bg-[#8a0e20]", prize: "bg-[#d5d9df]/80" };

function Label({ kind }: { kind: Diploma["kind"] }) {
	return (
		<span
			className={`rounded-full bg-gradient-to-br px-2 py-0.5 font-semibold text-[11px] text-black ${face[kind]}`}
		>
			{kind === "winner" ? "Победитель" : "Призёр"}
		</span>
	);
}

function describe(p: Person) {
	return `${p.name}: ${p.diplomas
		.map((d) => `${d.kind === "winner" ? "победитель" : "призёр"} ${d.season}`)
		.join(", ")}`;
}

type Active = { i: number; x: number; top: number; bottom: number };

export function DiplomaWall({ people }: { people: Person[] }) {
	const wrap = useRef<HTMLDivElement>(null);
	const [active, setActive] = useState<Active | null>(null);

	useEffect(() => {
		if (!active) return;
		const close = (e: Event) => {
			if (
				e instanceof KeyboardEvent
					? e.key === "Escape"
					: !wrap.current?.contains(e.target as Node)
			)
				setActive(null);
		};
		document.addEventListener("keydown", close);
		document.addEventListener("pointerdown", close);
		return () => {
			document.removeEventListener("keydown", close);
			document.removeEventListener("pointerdown", close);
		};
	}, [active]);

	const show = (i: number, el: HTMLElement) => {
		const w = wrap.current?.getBoundingClientRect();
		if (!w) return;
		const r = el.getBoundingClientRect();
		setActive({
			i,
			x: r.left + r.width / 2 - w.left,
			top: r.top - w.top,
			bottom: r.bottom - w.top,
		});
	};

	const person = active && people[active.i];
	const width = wrap.current?.clientWidth ?? CARD_W;
	const cardH = person ? 64 + person.diplomas.length * 46 : 0;
	const above = active ? active.top > cardH + 8 : true;

	return (
		<div ref={wrap} className="relative">
			<ul
				className="flex flex-wrap items-end gap-1.5 [--dh:22px] [--dw:17px] sm:gap-2 sm:[--dh:28px] sm:[--dw:22px]"
				aria-label="Дипломы учеников сборной"
			>
				{people.map((p, i) => {
					const extra = (p.diplomas.length - 1) * STEP;
					return (
						<li key={p.name} className="flex">
							<button
								type="button"
								aria-label={describe(p)}
								onMouseEnter={(e) => show(i, e.currentTarget)}
								onMouseLeave={() => setActive(null)}
								onFocus={(e) => show(i, e.currentTarget)}
								onBlur={() => setActive(null)}
								onClick={(e) => show(i, e.currentTarget)}
								className={`hover:-translate-y-0.5 relative block cursor-pointer rounded-[4px] outline-none transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-white ${active?.i === i ? "-translate-y-0.5" : ""}`}
								style={{
									width: `calc(var(--dw) + ${extra}px)`,
									height: `calc(var(--dh) + ${extra}px)`,
								}}
							>
								{p.diplomas.map((d, j) => (
									<span
										key={d.season}
										className={`absolute overflow-hidden rounded-[4px] ${cover[d.kind]}`}
										style={{
											width: "var(--dw)",
											height: "var(--dh)",
											left: (p.diplomas.length - 1 - j) * STEP,
											top: j * STEP,
										}}
									>
										<span
											className={`-translate-x-1/2 absolute top-[26%] left-1/2 h-1.5 w-1.5 rounded-full ${stamp[d.kind]}`}
										/>
										<span
											className={`-translate-x-1/2 absolute top-[62%] left-1/2 h-px w-[46%] rounded-full ${stamp[d.kind]}`}
										/>
									</span>
								))}
							</button>
						</li>
					);
				})}
			</ul>

			{active && person && (
				<div
					role="tooltip"
					className="pointer-events-none absolute z-20 rounded-2xl border border-line bg-surface-2/95 p-4 shadow-[0_20px_40px_-12px_rgb(0_0_0/0.9)] backdrop-blur-md"
					style={{
						width: CARD_W,
						left: Math.min(
							Math.max(active.x - CARD_W / 2, 0),
							Math.max(width - CARD_W, 0),
						),
						...(above
							? { bottom: `calc(100% - ${active.top - 8}px)` }
							: { top: active.bottom + 8 }),
					}}
				>
					<div className="font-bold font-display text-base leading-tight">
						{person.name}
					</div>
					{person.diplomas.length > 1 && (
						<div className="mt-0.5 text-muted text-xs">
							{person.diplomas.length} диплома ВсОШ по ИБ
						</div>
					)}
					<ul className="mt-3 space-y-2.5">
						{[...person.diplomas].reverse().map((d) => (
							<li key={d.season}>
								<div className="flex flex-wrap items-center gap-2 text-sm">
									<Label kind={d.kind} />
									<span className="font-mono text-xs">{d.season}</span>
									<span className="text-muted text-xs">
										{d.grade} класс
										{d.studyGrade ? ` (из ${d.studyGrade} класса)` : ""}
									</span>
								</div>
								<div className="mt-0.5 truncate text-[11px] text-muted">
									{d.school}
								</div>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
