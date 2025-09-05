"use client";

import type { PublicTaskDTO } from "@/api/exam";
import Markdown from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { UiAnswerPayload } from "@/lib/answers";
import { getPointsPlural } from "@/lib/utils";
import {
	AlertCircle,
	CheckCircle,
	CheckSquare,
	CircleDot,
	ExternalLink,
	FileText,
	Flag,
	GripVertical,
	ListChecks,
	ListOrdered,
	Loader2,
	Type as TypeIcon,
	Upload,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type TaskConfig = {
	name?: string;
	options?: string[];
	items?: string[];
	max_chars_count?: number;
	max_size?: number;
	task_id?: number;
};

function hasId(obj: unknown): obj is { id: number } {
	return (
		typeof obj === "object" &&
		obj !== null &&
		"id" in obj &&
		typeof (obj as { id?: unknown }).id === "number"
	);
}

function isDTO(obj: unknown): obj is PublicTaskDTO {
	return (
		typeof obj === "object" &&
		obj !== null &&
		"title" in obj &&
		"configuration" in obj
	);
}

function getDtoTaskType(obj: unknown): string | undefined {
	if (
		typeof obj === "object" &&
		obj !== null &&
		"task_type" in obj &&
		typeof (obj as { task_type?: unknown }).task_type === "string"
	) {
		return (obj as { task_type: string }).task_type;
	}
	return undefined;
}

interface TaskPlayerProps {
	task: PublicTaskDTO | { id: number };
	onComplete: () => void;
	onNext: () => void;
	onProgress?: (questionId: number, hasAnswer: boolean) => void;
	previewMode?: boolean;
	onAnswer?: (payload: UiAnswerPayload) => void;
	disabled?: boolean;
	isLast?: boolean;
	initial?: number | number[] | string | Record<number, number>;
	onCtfdSync?: (taskId: number) => Promise<void> | void;
	/** If true, the CTFd task is already synced; show success banner initially */
	ctfdAlreadySynced?: boolean;
}

type AnswerValue =
	| number
	| number[]
	| string
	| string[]
	| Record<number, number>;

export function TaskPlayer({
	task,
	onComplete,
	onNext,
	onProgress,
	previewMode,
	onAnswer,
	disabled = false,
	isLast = false,
	initial,
	onCtfdSync,
	ctfdAlreadySynced = false,
}: TaskPlayerProps) {
	const { t } = useTranslation("common");
	const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
	// Track the last "saved" (persisted) answer to compare against
	const [savedAnswers, setSavedAnswers] = useState<Record<number, AnswerValue>>(
		{},
	);
	// Helper to know if a saved baseline exists for a task id
	const hasSavedBaseline = useCallback(
		(tid: number) => Object.prototype.hasOwnProperty.call(savedAnswers, tid),
		[savedAnswers],
	);
	const [canSubmit, setCanSubmit] = useState(true);
	const [ctfdSyncing, setCtfdSyncing] = useState(false);
	const [ctfdError, setCtfdError] = useState<string | null>(null);
	const [ctfdSuccess, setCtfdSuccess] = useState<string | null>(null);

	const [touchDragFrom, setTouchDragFrom] = useState<number | null>(null);
	const [touchOverIndex, setTouchOverIndex] = useState<number | null>(null);

	const taskId = hasId(task) ? task.id : undefined;
	const interactionsLocked = disabled;

	const dto = isDTO(task) ? (task as PublicTaskDTO) : undefined;
	const cfg: TaskConfig | undefined = dto?.configuration as
		| TaskConfig
		| undefined;
	const cfgName: string | undefined =
		typeof cfg?.name === "string" ? cfg.name : undefined;

	/* biome-ignore lint/correctness/useExhaustiveDependencies: recompute submit state when task, answers, or saved baselines change */
	useEffect(() => {
		if (typeof taskId !== "number") return;
		const current = answers[taskId];
		if (current === undefined) {
			setCanSubmit(false);
			return;
		}
		setCanSubmit(computeCanSubmitFor(taskId, current));
	}, [taskId, answers, savedAnswers]);

	// Normalization helpers so we can compare answers robustly across representations
	const normalizeSingle = useCallback(
		(val: unknown): string | undefined => {
			if (typeof val === "string") return val;
			if (typeof val === "number" && Array.isArray(cfg?.options)) {
				const label = cfg?.options?.[val];
				if (typeof label === "string" && label.length > 0) return label;
			}
			return undefined;
		},
		[cfg],
	);
	const normalizeMultiple = useCallback(
		(val: unknown): string[] => {
			const out: string[] = [];
			if (Array.isArray(val)) {
				for (const v of val) {
					if (typeof v === "string") out.push(v);
					else if (typeof v === "number" && Array.isArray(cfg?.options)) {
						const label = cfg?.options?.[v];
						if (typeof label === "string") out.push(label);
					}
				}
			}
			// unique + sorted for order-insensitive compare
			return Array.from(new Set(out)).sort((a, b) => a.localeCompare(b));
		},
		[cfg],
	);
	const normalizeOrdering = useCallback(
		(val: unknown): string[] => {
			// We operate with string[] order; also support number[] indices mapping to labels
			if (Array.isArray(val)) {
				const arr = val as unknown[];
				if (arr.every((v) => typeof v === "string")) {
					return arr as string[];
				}
				if (
					arr.every((v) => typeof v === "number") &&
					Array.isArray(cfg?.items)
				) {
					return (arr as number[])
						.map((i) =>
							Array.isArray(cfg?.items) ? cfg?.items?.[i] : undefined,
						)
						.filter((s): s is string => typeof s === "string");
				}
			}
			// Support legacy map representation: { [itemIdx]: position }
			if (
				val &&
				typeof val === "object" &&
				!Array.isArray(val) &&
				Array.isArray(cfg?.items)
			) {
				const orderMap = val as Record<string | number, unknown>;
				const entries: { itemIdx: number; position: number }[] = [];
				for (const [k, v] of Object.entries(orderMap)) {
					const itemIdx = Number.parseInt(k);
					const position = typeof v === "number" ? v : Number(v);
					if (Number.isFinite(itemIdx) && Number.isFinite(position)) {
						entries.push({ itemIdx, position });
					}
				}
				entries.sort((a, b) => a.position - b.position);
				return entries
					.map((e) => cfg?.items?.[e.itemIdx])
					.filter((s): s is string => typeof s === "string");
			}
			if (Array.isArray(cfg?.items)) return [...(cfg?.items ?? [])];
			return [];
		},
		[cfg],
	);
	const normalizeText = useCallback((val: unknown): string => {
		return typeof val === "string" ? val : "";
	}, []);
	const normalize = useCallback(
		(val: unknown): AnswerValue | undefined => {
			switch (getTaskTypeKey()) {
				case "single_choice":
					return normalizeSingle(val) ?? "";
				case "multiple_choice":
					return normalizeMultiple(val);
				case "short_text":
					return normalizeText(val);
				case "long_text":
					return normalizeText(val);
				case "ordering":
					return normalizeOrdering(val);
				default:
					return (val as AnswerValue) ?? undefined;
			}
		},
		[normalizeSingle, normalizeMultiple, normalizeText, normalizeOrdering],
	);
	const areEqual = useCallback((a: unknown, b: unknown): boolean => {
		const type = getTaskTypeKey();
		if (type === "multiple_choice" || type === "ordering") {
			const aa = Array.isArray(a) ? (a as unknown[]) : [];
			const bb = Array.isArray(b) ? (b as unknown[]) : [];
			if (aa.length !== bb.length) return false;
			for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
			return true;
		}
		return a === b;
	}, []);
	// For single_choice, compare and validate by option index to avoid label mismatch issues
	const normalizeSingleIndex = useCallback(
		(val: unknown): number | undefined => {
			if (!Array.isArray(cfg?.options)) return undefined;
			if (typeof val === "number") {
				return Number.isInteger(val) && val >= 0 && val < cfg.options.length
					? val
					: undefined;
			}
			if (typeof val === "string") {
				const idx = cfg.options.indexOf(val);
				return idx >= 0 ? idx : undefined;
			}
			return undefined;
		},
		[cfg],
	);

	const hasMeaningfulAnswer = useCallback(
		(val: unknown): boolean => {
			switch (getTaskTypeKey()) {
				case "single_choice":
					return normalizeSingleIndex(val) !== undefined;
				case "multiple_choice":
					return Array.isArray(val) && val.length > 0;
				case "short_text":
				case "long_text":
					return typeof val === "string" && val.trim().length > 0;
				case "ordering":
					return Array.isArray(val) && val.length > 0;
				default:
					return true;
			}
		},
		[normalizeSingleIndex],
	);
	const computeCanSubmitFor = useCallback(
		(tid: number, currentRaw: unknown) => {
			// Special handling for single_choice: compare by option indices
			if (getTaskTypeKey() === "single_choice") {
				const curIdx = normalizeSingleIndex(currentRaw);
				if (!hasSavedBaseline(tid)) {
					return curIdx !== undefined; // meaningful if it maps to an option
				}
				const savedIdx = normalizeSingleIndex(savedAnswers[tid]);
				return curIdx !== undefined && curIdx !== savedIdx;
			}
			// Default path for other types uses normalized value and areEqual
			const cur = normalize(currentRaw);
			if (!hasSavedBaseline(tid)) {
				return hasMeaningfulAnswer(cur);
			}
			const saved = normalize(savedAnswers[tid]);
			return hasMeaningfulAnswer(cur) && !areEqual(cur, saved);
		},
		[
			savedAnswers,
			areEqual,
			hasSavedBaseline,
			normalize,
			hasMeaningfulAnswer,
			normalizeSingleIndex,
		],
	);

	useEffect(() => {
		if (typeof taskId !== "number") return;
		// If we already have a saved baseline, don't override it from initial.
		const hasSaved = hasSavedBaseline(taskId);
		if (initial === undefined || initial === null) {
			return;
		}
		const normalizedInitial = normalize(initial) as AnswerValue;

		// Always seed saved baseline if it's not present yet
		if (!hasSaved) {
			setSavedAnswers((prev) => ({ ...prev, [taskId]: normalizedInitial }));
		}

		// For current answer, prefer initial if we don't have one yet OR if it's just the default ordering
		const hasCurrent = answers[taskId] !== undefined;
		const isOrdering =
			getTaskTypeKey() === "ordering" && Array.isArray(cfg?.items);
		let isDefaultOrdering = false;
		if (isOrdering) {
			const defaultOrder = [...(cfg?.items as string[])];
			const curNormalized = normalize(answers[taskId]);
			isDefaultOrdering = areEqual(curNormalized, defaultOrder);
		}
		if (!hasCurrent || isDefaultOrdering) {
			setAnswers((prev) => ({ ...prev, [taskId]: normalizedInitial }));
			setCanSubmit(computeCanSubmitFor(taskId, normalizedInitial));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		cfg,
		answers,
		taskId,
		initial,
		computeCanSubmitFor,
		normalize,
		areEqual,
		hasSavedBaseline,
	]);

	// Reset CTFd banners on task switch; do not auto-show success for already synced tasks
	useEffect(() => {
		// Explicitly reference taskId so the dependency is meaningful for linters
		if (typeof taskId !== "number") return;
		if (getTaskTypeKey() !== "ctfd") return;
		setCtfdError(null);
		setCtfdSuccess(null);
	}, [taskId]);

	if (typeof taskId !== "number") {
		return null;
	}

	useEffect(() => {
		if (typeof taskId !== "number") return;
		if (cfgName !== "ordering" || !Array.isArray(cfg?.items)) return;

		if (answers[taskId] === undefined) {
			const defaultOrder = [...cfg.items];
			setAnswers((prev) => ({ ...prev, [taskId]: defaultOrder }));
			onProgress?.(taskId, true);
			onAnswer?.({ name: "ordering", answer: defaultOrder });
			// Enable submit for ordering when no saved baseline exists and default order is meaningful
			setCanSubmit(computeCanSubmitFor(taskId, defaultOrder));
		}
	}, [
		taskId,
		cfgName,
		cfg?.items,
		answers,
		onProgress,
		onAnswer,
		computeCanSubmitFor,
	]);

	// Helpers for touch dragging on mobile
	const startTouchDrag = (startIdx: number) => {
		if (interactionsLocked) return;
		setTouchDragFrom(startIdx);
		setTouchOverIndex(startIdx);
	};
	const updateTouchDrag = (clientX: number, clientY: number) => {
		if (interactionsLocked) return;
		if (touchDragFrom === null) return;
		const el = document.elementFromPoint(
			clientX,
			clientY,
		) as HTMLElement | null;
		if (!el) return;
		const itemEl = el.closest(
			'[data-ordering-item="true"]',
		) as HTMLElement | null;
		if (!itemEl) return;
		const idxStr = itemEl.getAttribute("data-index");
		if (idxStr === null) return;
		const overIdx = Number.parseInt(idxStr);
		if (!Number.isNaN(overIdx)) setTouchOverIndex(overIdx);
	};
	const endTouchDrag = () => {
		if (interactionsLocked) {
			setTouchDragFrom(null);
			setTouchOverIndex(null);
			return;
		}
		if (
			touchDragFrom !== null &&
			touchOverIndex !== null &&
			touchDragFrom !== touchOverIndex
		) {
			const currentItems = getOrderedItems();
			const newOrder = moveItem(touchDragFrom, touchOverIndex, currentItems);
			handleOrdering(newOrder);
		}
		setTouchDragFrom(null);
		setTouchOverIndex(null);
	};

	const getMappedTaskType = (): string | undefined => {
		const t = getDtoTaskType(dto);
		if (typeof t === "string" && t.length > 0) return t;
		switch (cfgName) {
			case "single_choice":
				return "SingleChoice";
			case "multiple_choice":
				return "MultipleChoice";
			case "short_text":
				return "ShortText";
			case "long_text":
				return "LongText";
			case "ordering":
				return "Ordering";
			case "file_upload":
				return "FileUpload";
			case "ctfd":
				return "CTFd";
			default:
				return undefined;
		}
	};

	const getTaskTypeKey = (): string | undefined => {
		const mapped = getMappedTaskType();
		switch (mapped) {
			case "SingleChoice":
				return "single_choice";
			case "MultipleChoice":
				return "multiple_choice";
			case "ShortText":
				return "short_text";
			case "LongText":
				return "long_text";
			case "Ordering":
				return "ordering";
			case "FileUpload":
				return "file_upload";
			case "CTFd":
				return "ctfd";
			default:
				if (
					cfgName === "single_choice" ||
					cfgName === "multiple_choice" ||
					cfgName === "short_text" ||
					cfgName === "long_text" ||
					cfgName === "ordering" ||
					cfgName === "file_upload" ||
					cfgName === "ctfd"
				)
					return cfgName;
				return undefined;
		}
	};

	const getTaskIcon = () => {
		const type = getMappedTaskType();
		const common = "mr-3 h-4 w-4 text-purple-400";
		switch (type) {
			case "SingleChoice":
				return <CircleDot className={common} />;
			case "MultipleChoice":
				return <CheckSquare className={common} />;
			case "ShortText":
				return <TypeIcon className={common} />;
			case "LongText":
				return <FileText className={common} />;
			case "Ordering":
				return <ListOrdered className={common} />;
			case "FileUpload":
				return <Upload className={common} />;
			case "CTFd":
				return <Flag className={common} />;
			default:
				return <ListChecks className={common} />;
		}
	};

	const handleRadio = (value: string) => {
		if (interactionsLocked) return;
		const nextVal = value;
		setAnswers((prev) => ({ ...prev, [taskId]: nextVal }));
		setCanSubmit(computeCanSubmitFor(taskId, nextVal));
		onProgress?.(taskId, !!value);
		onAnswer?.({ name: "single_choice", answer: value });
	};
	const handleCheck = (opt: string, checked: boolean) => {
		if (interactionsLocked) return;
		const currentAnswers = Array.isArray(answers[taskId])
			? (answers[taskId] as string[])
			: [];
		const nextAnswers = checked
			? [...currentAnswers, opt]
			: currentAnswers.filter((i) => i !== opt);
		setAnswers((prev) => ({ ...prev, [taskId]: nextAnswers }));
		setCanSubmit(computeCanSubmitFor(taskId, nextAnswers));
		onProgress?.(taskId, nextAnswers.length > 0);
		onAnswer?.({ name: "multiple_choice", answers: nextAnswers });
	};
	const handleText = (val: string) => {
		if (interactionsLocked) return;
		setAnswers((prev) => ({ ...prev, [taskId]: val }));
		setCanSubmit(computeCanSubmitFor(taskId, val));
		onProgress?.(taskId, val.trim().length > 0);

		if (cfgName === "short_text")
			onAnswer?.({ name: "short_text", answer: val });
		else if (cfgName === "long_text")
			onAnswer?.({ name: "long_text", answer: val });
	};

	const handleOrdering = (newOrder: string[]) => {
		if (interactionsLocked) return;
		setAnswers((prev) => ({ ...prev, [taskId]: newOrder }));
		setCanSubmit(computeCanSubmitFor(taskId, newOrder));
		onProgress?.(taskId, true);
		onAnswer?.({ name: "ordering", answer: newOrder });
	};

	const moveItem = (
		fromIndex: number,
		toIndex: number,
		items: string[],
	): string[] => {
		const newItems = [...items];
		const movedItem = newItems.splice(fromIndex, 1)[0];
		if (movedItem) {
			newItems.splice(toIndex, 0, movedItem);
		}
		return newItems;
	};

	const getOrderedItems = (): string[] => {
		if (!Array.isArray(cfg?.items)) return [];

		const ans = answers[taskId];
		if (Array.isArray(ans)) {
			// If the state is a string[], return it (validated against cfg.items to be safe)
			if ((ans as unknown[]).every((v) => typeof v === "string")) {
				const set = new Set(cfg.items);
				return (ans as string[]).filter((s) => set.has(s));
			}
			// Backward-compatibility: number[] indices -> map to strings
			if ((ans as unknown[]).every((v) => typeof v === "number")) {
				const orderIndices = ans as number[];
				if (orderIndices.length === cfg.items.length) {
					return orderIndices
						.map((idx) => cfg.items?.[idx])
						.filter((item): item is string => typeof item === "string");
				}
			}
		}

		if (typeof ans === "object" && ans !== null && !Array.isArray(ans)) {
			const orderMap = ans as Record<number, number>;
			const sortedEntries = Object.entries(orderMap)
				.map(([itemIdx, position]) => ({
					itemIdx: Number.parseInt(itemIdx),
					position,
				}))
				.sort((a, b) => a.position - b.position);
			return sortedEntries
				.map((entry) => cfg.items?.[entry.itemIdx])
				.filter((item): item is string => typeof item === "string");
		}

		return [...cfg.items];
	};

	// Preview mode
	if (previewMode) {
		return (
			<div className="mx-auto max-w-4xl">
				<Card className="border-slate-800 bg-slate-900">
					<CardHeader>
						<CardTitle className="text-white">
							<span className="inline-flex items-center">
								{getTaskIcon()}
								{dto?.title ?? `${t("task")} #${taskId}`}
							</span>
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{dto?.description ? <Markdown content={dto.description} /> : null}
						<div className="text-slate-400 text-xs">
							{dto?.points ?? 0} {t(getPointsPlural(dto?.points ?? 0))} ·{" "}
							{t(getTaskTypeKey() ?? "task")}
						</div>
						<div className="my-4 border-slate-800 border-t" />
						{cfgName === "single_choice" && Array.isArray(cfg?.options) && (
							<RadioGroup value={""} onValueChange={() => {}} disabled>
								<div className="space-y-3">
									{cfg.options.map((opt: string, idx: number) => (
										<div key={opt} className="flex items-center space-x-2">
											<RadioGroupItem
												value={opt}
												id={`preview-sc-${idx}`}
												className="border-slate-600 text-red-600"
											/>
											<Label
												htmlFor={`preview-sc-${idx}`}
												className="text-slate-300"
											>
												{opt}
											</Label>
										</div>
									))}
								</div>
							</RadioGroup>
						)}
						{cfgName === "multiple_choice" && Array.isArray(cfg?.options) && (
							<div className="space-y-3">
								{cfg.options.map((opt: string, idx: number) => (
									<div key={opt} className="flex items-center space-x-2">
										<Checkbox
											id={`preview-mc-${idx}`}
											disabled
											checked={false}
											className="border-slate-600 data-[state=checked]:bg-red-600"
										/>
										<Label
											htmlFor={`preview-mc-${idx}`}
											className="text-slate-300"
										>
											{opt}
										</Label>
									</div>
								))}
							</div>
						)}
						{cfgName === "short_text" && (
							<input
								type="text"
								placeholder={t("short_answer_placeholder")}
								className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white placeholder-slate-400"
								maxLength={
									typeof cfg?.max_chars_count === "number"
										? cfg.max_chars_count
										: undefined
								}
								disabled
							/>
						)}
						{cfgName === "long_text" && (
							<textarea
								placeholder={t("long_answer_placeholder")}
								className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white placeholder-slate-400"
								rows={5}
								maxLength={
									typeof cfg?.max_chars_count === "number"
										? cfg.max_chars_count
										: undefined
								}
								disabled
							/>
						)}
						{cfgName === "ordering" && Array.isArray(cfg?.items) && (
							<div className="space-y-2">
								{cfg.items.map((it: string, idx: number) => (
									<div
										key={it}
										className="cursor-move rounded-lg border border-slate-700 bg-slate-800 p-3 text-slate-300"
									>
										{idx + 1}. {it}
									</div>
								))}
							</div>
						)}
						{cfgName === "file_upload" && (
							<div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-slate-300">
								{t("file_upload_preview_disabled", {
									size:
										typeof cfg?.max_size === "number"
											? `${cfg.max_size} bytes`
											: t("unknown"),
								})}
							</div>
						)}
						{!cfgName && (
							<div className="rounded-md border border-slate-800 bg-slate-950 p-3 text-slate-400 text-sm">
								{t("staff_preview_notice")}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		);
	}

	// Live mode
	return (
		<div className="mx-auto max-w-4xl">
			<Card className="border-slate-800 bg-slate-900">
				<CardHeader>
					<CardTitle className="text-white">
						<span className="inline-flex items-center">
							{getTaskIcon()}
							{dto?.title ?? `${t("task")} #${taskId}`}
						</span>
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{dto?.description ? <Markdown content={dto.description} /> : null}
					<div className="text-slate-400 text-xs">
						{dto?.points ?? 0} {t(getPointsPlural(dto?.points ?? 0))} ·{" "}
						{t(getTaskTypeKey() ?? "task")}
					</div>
					<div className="my-4 border-slate-800 border-t" />
					{cfgName === "single_choice" && Array.isArray(cfg?.options) && (
						<RadioGroup
							value={
								typeof answers[taskId] === "string"
									? (answers[taskId] as string)
									: typeof answers[taskId] === "number" &&
											Array.isArray(cfg?.options)
										? (cfg?.options?.[answers[taskId] as number] ?? undefined)
										: undefined
							}
							onValueChange={handleRadio}
						>
							<div className="space-y-3">
								{cfg.options.map((opt: string, idx: number) => (
									<div key={opt} className="flex items-center space-x-2">
										<RadioGroupItem
											value={opt}
											id={`live-sc-${idx}`}
											className="border-slate-600 text-red-600"
										/>
										<Label
											htmlFor={`live-sc-${idx}`}
											className="text-slate-300"
										>
											{opt}
										</Label>
									</div>
								))}
							</div>
						</RadioGroup>
					)}
					{cfgName === "multiple_choice" && Array.isArray(cfg?.options) && (
						<div className="space-y-3">
							{cfg.options.map((opt: string, idx: number) => {
								let selected: string[] = [];
								const ans = answers[taskId];
								if (Array.isArray(ans)) {
									if ((ans as unknown[]).every((v) => typeof v === "string")) {
										selected = ans as string[];
									} else if (
										(ans as unknown[]).every((v) => typeof v === "number")
									) {
										selected = (ans as number[])
											.map((i) =>
												Array.isArray(cfg?.options)
													? cfg.options[i]
													: undefined,
											)
											.filter((v): v is string => typeof v === "string");
									}
								}
								const checked = selected.includes(opt);
								return (
									<div key={opt} className="flex items-center space-x-2">
										<Checkbox
											id={`live-mc-${idx}`}
											checked={checked}
											onCheckedChange={(v) => handleCheck(opt, Boolean(v))}
											disabled={interactionsLocked}
											className="border-slate-600 data-[state=checked]:bg-red-600"
										/>
										<Label
											htmlFor={`live-mc-${idx}`}
											className="text-slate-300"
										>
											{opt}
										</Label>
									</div>
								);
							})}
						</div>
					)}
					{cfgName === "short_text" && (
						<input
							type="text"
							placeholder={t("short_answer_placeholder")}
							className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white placeholder-slate-400"
							maxLength={
								typeof cfg?.max_chars_count === "number"
									? cfg.max_chars_count
									: undefined
							}
							value={(answers[taskId] as string) ?? ""}
							onChange={(e) => handleText(e.target.value)}
							disabled={interactionsLocked}
						/>
					)}
					{cfgName === "long_text" && (
						<textarea
							placeholder={t("long_answer_placeholder")}
							className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white placeholder-slate-400"
							rows={5}
							maxLength={
								typeof cfg?.max_chars_count === "number"
									? cfg.max_chars_count
									: undefined
							}
							value={(answers[taskId] as string) ?? ""}
							onChange={(e) => handleText(e.target.value)}
							disabled={interactionsLocked}
						/>
					)}
					{cfgName === "ordering" && Array.isArray(cfg?.items) && (
						<div className="space-y-2">
							<div className="mb-3 text-slate-400 text-sm">
								{t("drag_to_reorder")}
							</div>
							{getOrderedItems().map((item: string, idx: number) => {
								const originalItems = cfg?.items || [];
								const originalIndex = originalItems.indexOf(item);
								return (
									<div
										key={`${item}-${originalIndex}`}
										data-ordering-item="true"
										data-index={idx}
										className={`group flex cursor-move select-none items-center gap-3 rounded-lg border bg-slate-800 p-3 text-slate-300 transition-colors hover:border-slate-600 ${
											touchDragFrom !== null ? "touch-none" : ""
										} ${
											touchDragFrom !== null && touchOverIndex === idx
												? "border-red-500"
												: "border-slate-700"
										} ${touchDragFrom === idx ? "opacity-75" : ""}`}
										draggable={!interactionsLocked}
										onDragStart={(e) => {
											if (interactionsLocked) {
												e.preventDefault();
												return;
											}
											e.dataTransfer.setData("text/plain", idx.toString());
											e.currentTarget.style.opacity = "0.5";
										}}
										onDragEnd={(e) => {
											e.currentTarget.style.opacity = "1";
										}}
										onDragOver={(e) => {
											if (!interactionsLocked) {
												e.preventDefault();
											}
										}}
										onDrop={(e) => {
											if (interactionsLocked) return;
											e.preventDefault();
											const fromIndex = Number.parseInt(
												e.dataTransfer.getData("text/plain"),
											);
											const toIndex = idx;
											if (fromIndex !== toIndex) {
												const currentItems = getOrderedItems();
												const newOrder = moveItem(
													fromIndex,
													toIndex,
													currentItems,
												);
												handleOrdering(newOrder);
											}
										}}
										onTouchStart={(e) => {
											if (interactionsLocked) return;
											if (e.touches.length === 0) return;
											// Initialize touch drag from this index
											startTouchDrag(idx);
										}}
										onTouchMove={(e) => {
											if (interactionsLocked) return;
											if (touchDragFrom === null) return;
											const touch = e.touches.item(0);
											if (!touch) return;
											// Prevent page scroll while dragging
											e.preventDefault();
											updateTouchDrag(touch.clientX, touch.clientY);
										}}
										onTouchEnd={() => {
											endTouchDrag();
										}}
										onTouchCancel={() => {
											endTouchDrag();
										}}
									>
										<GripVertical
											className={`h-4 w-4 text-slate-500 ${!interactionsLocked ? "group-hover:text-slate-400" : ""}`}
										/>
										<span className="flex-1">{item}</span>
									</div>
								);
							})}
							{interactionsLocked && (
								<div className="text-slate-500 text-xs">
									{t("interactions_locked")}
								</div>
							)}
						</div>
					)}
					{cfgName === "file_upload" && (
						<div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-slate-300">
							{t("file_upload_not_implemented", {
								size:
									typeof cfg?.max_size === "number"
										? `${cfg.max_size} bytes`
										: t("unknown"),
							})}
						</div>
					)}
					<div
						className={`flex items-center gap-3 ${getTaskTypeKey() === "ctfd" ? "justify-between" : "justify-end"}`}
					>
						{getTaskTypeKey() === "ctfd" && typeof cfg?.task_id === "number" ? (
							<a
								href={`https://ctfd.infosec.moscow/challenges#task-${cfg.task_id}`}
								target="_blank"
								rel="noreferrer"
								className="flex h-10 items-center rounded-md bg-red-600 px-2 text-white hover:bg-red-700 sm:px-3"
							>
								<span>{t("open_in_ctfd") || "Open in CTFd"}</span>
								<ExternalLink className="ml-1 h-4 w-4" />
							</a>
						) : null}
						{getTaskTypeKey() === "ctfd" ? (
							<Button
								className="bg-red-600 px-2 text-white hover:bg-red-700 sm:px-3"
								title={
									ctfdSyncing
										? t("syncing") || "Syncing..."
										: t("sync_solution") || "Synchronize solution"
								}
								onClick={async () => {
									if (typeof taskId !== "number") return;
									if (ctfdSyncing) return;
									try {
										setCtfdError(null);
										setCtfdSuccess(null);
										setCtfdSyncing(true);
										setCanSubmit(false);
										await onCtfdSync?.(taskId);
										setCtfdSuccess(
											t("ctfd_sync_success") || "Synchronized successfully",
										);
									} catch (err) {
										let message: string | undefined;
										try {
											if (typeof err === "object" && err) {
												const e = err as Record<string, unknown> & {
													response?: { status?: number; data?: unknown };
													message?: string;
												};
												const resp = e.response;
												const dataUnknown = resp?.data;
												const isObj = (
													v: unknown,
												): v is Record<string, unknown> =>
													typeof v === "object" && v !== null;

												if (isObj(dataUnknown)) {
													const dataObj = dataUnknown as Record<
														string,
														unknown
													>;
													if (typeof dataObj.error === "string") {
														message = dataObj.error;
													} else if (isObj(dataObj.error)) {
														const errObj = dataObj.error as Record<
															string,
															unknown
														>;
														if (typeof errObj.detail === "string")
															message = errObj.detail;
														else if (typeof errObj.message === "string")
															message = errObj.message;
														else if (typeof errObj.error === "string")
															message = errObj.error;
														else if (Array.isArray(errObj.errors))
															message = errObj.errors
																.map((x) => String(x))
																.join("; ");
														else message = JSON.stringify(errObj);
													} else if (typeof dataObj.message === "string") {
														message = dataObj.message;
													} else if (typeof dataObj.detail === "string") {
														message = dataObj.detail;
													} else if (Array.isArray(dataObj.errors)) {
														message = dataObj.errors
															.map((x) => String(x))
															.join("; ");
													}
												}

												if (!message && typeof e.message === "string") {
													message = e.message;
												}

												if (
													typeof message === "string" &&
													/^(\{|\[)/.test(message.trim())
												) {
													try {
														const parsed = JSON.parse(message);
														if (typeof parsed === "string") message = parsed;
														else if (isObj(parsed)) {
															const p = parsed as Record<string, unknown>;
															if (typeof p.detail === "string")
																message = p.detail;
															else if (typeof p.message === "string")
																message = p.message;
															else if (typeof p.error === "string")
																message = p.error;
															else if (Array.isArray(p.errors))
																message = p.errors
																	.map((x) => String(x))
																	.join("; ");
															else message = JSON.stringify(p);
														}
													} catch {}
												}
											}
										} catch {}

										if (typeof message === "string") {
											const normalized = message.trim();
											if (normalized === "You haven't solved this task yet") {
												message = t("ctfd_error_not_solved");
											} else if (
												normalized === "No linked ctfd account found" ||
												normalized === "No linked CTFd account found"
											) {
												message = t("ctfd_error_no_account");
											}
										}

										setCtfdError(
											message ?? (t("failed_operation") || "Operation failed"),
										);
									} finally {
										setCtfdSyncing(false);
										setCanSubmit(true);
									}
								}}
								disabled={disabled || ctfdSyncing || Boolean(ctfdSuccess)}
								aria-busy={ctfdSyncing}
							>
								{ctfdSyncing ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										<span>{t("syncing") || "Syncing..."}</span>
									</>
								) : (
									<>
										<Flag className="mr-2 h-4 w-4" />
										<span>{t("sync_solution") || "Synchronize solution"}</span>
									</>
								)}
							</Button>
						) : (
							<Button
								className="bg-red-600 text-white hover:bg-red-700"
								onClick={() => {
									onComplete();
									// After persisting, treat current as saved baseline
									const cur = answers[taskId];
									setSavedAnswers((prev) => ({
										...prev,
										[taskId]: normalize(cur) as AnswerValue,
									}));
									setCanSubmit(false);
								}}
								disabled={disabled || !canSubmit}
							>
								{t("submit")}
							</Button>
						)}
					</div>
					{getTaskTypeKey() === "ctfd" ? (
						ctfdSuccess ? (
							<div className="mt-2 flex items-start gap-2 rounded-md border border-green-700 bg-green-950/30 p-2 text-green-300 text-sm">
								<CheckCircle className="mt-0.5 h-4 w-4 text-green-400" />
								<span>{ctfdSuccess}</span>
							</div>
						) : ctfdError ? (
							<div className="mt-2 flex items-start gap-2 rounded-md border border-red-700 bg-red-950/40 p-2 text-red-300 text-sm">
								<AlertCircle className="mt-0.5 h-4 w-4 text-red-400" />
								<span>{ctfdError}</span>
							</div>
						) : null
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}
