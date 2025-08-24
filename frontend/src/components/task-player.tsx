"use client";

import type { PublicTaskDTO } from "@/api/exam";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { UiAnswerPayload } from "@/lib/answers";
import {
	CheckSquare,
	CircleDot,
	FileText,
	Flag,
	GripVertical,
	ListChecks,
	ListOrdered,
	Type as TypeIcon,
	Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type TaskConfig = {
	name?: string;
	options?: string[];
	items?: string[];
	max_chars_count?: number;
	max_size?: number;
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
}: TaskPlayerProps) {
	const { t } = useTranslation("common");
	const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
	const [canSubmit, setCanSubmit] = useState(true);

	const [touchDragFrom, setTouchDragFrom] = useState<number | null>(null);
	const [touchOverIndex, setTouchOverIndex] = useState<number | null>(null);

	const taskId = hasId(task) ? task.id : undefined;
	const interactionsLocked = disabled;
	/* biome-ignore lint/correctness/useExhaustiveDependencies: reset when taskId changes intentionally */
	useEffect(() => {
		setCanSubmit(true);
	}, [taskId]);

	useEffect(() => {
		if (typeof taskId !== "number") return;
		if (initial === undefined || initial === null) return;
		setAnswers((prev) => ({ ...prev, [taskId]: initial }));
	}, [taskId, initial]);

	if (typeof taskId !== "number") {
		return null;
	}

	const dto = isDTO(task) ? (task as PublicTaskDTO) : undefined;
	const cfg: TaskConfig | undefined = dto?.configuration as
		| TaskConfig
		| undefined;
	const cfgName: string | undefined =
		typeof cfg?.name === "string" ? cfg.name : undefined;

	useEffect(() => {
		if (typeof taskId !== "number") return;
		if (cfgName !== "ordering" || !Array.isArray(cfg?.items)) return;

		if (answers[taskId] === undefined) {
			const defaultOrder = [...cfg.items];
			setAnswers((prev) => ({ ...prev, [taskId]: defaultOrder }));
			onProgress?.(taskId, true);
			onAnswer?.({ name: "ordering", answer: defaultOrder });
		}
	}, [taskId, cfgName, cfg?.items, answers, onProgress, onAnswer]);

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
		setAnswers((prev) => ({ ...prev, [taskId]: value }));
		setCanSubmit(true);
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
		setCanSubmit(true);
		onProgress?.(taskId, nextAnswers.length > 0);
		onAnswer?.({ name: "multiple_choice", answers: nextAnswers });
	};
	const handleText = (val: string) => {
		if (interactionsLocked) return;
		setAnswers((prev) => ({ ...prev, [taskId]: val }));
		setCanSubmit(true);
		onProgress?.(taskId, val.trim().length > 0);

		if (cfgName === "short_text")
			onAnswer?.({ name: "short_text", answer: val });
		else if (cfgName === "long_text")
			onAnswer?.({ name: "long_text", answer: val });
	};

	const handleOrdering = (newOrder: string[]) => {
		if (interactionsLocked) return;
		setAnswers((prev) => ({ ...prev, [taskId]: newOrder }));
		setCanSubmit(true);
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
								{dto?.title ?? `Task #${taskId}`}
							</span>
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{dto?.description ? (
							<div className="text-slate-300 text-sm">{dto.description}</div>
						) : null}
						<div className="text-slate-400 text-xs">
							{dto?.points ?? 0} pts · {cfgName ?? "task"}
						</div>
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
								placeholder="Short answer..."
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
								placeholder="Long answer..."
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
								File upload (max size:{" "}
								{typeof cfg?.max_size === "number"
									? `${cfg.max_size} bytes`
									: "unknown"}
								). Disabled in preview.
							</div>
						)}
						{!cfgName && (
							<div className="rounded-md border border-slate-800 bg-slate-950 p-3 text-slate-400 text-sm">
								This is a staff preview. Answers are not recorded and no attempt
								is active.
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
							{dto?.title ?? `Task #${taskId}`}
						</span>
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{dto?.description ? (
						<div className="text-slate-300 text-sm">{dto.description}</div>
					) : null}
					<div className="text-slate-400 text-xs">
						{dto?.points ?? 0} pts · {cfgName ?? "task"}
					</div>
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
							placeholder="Short answer..."
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
							placeholder="Long answer..."
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
								Drag and drop to reorder the items:
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
									Interactions are locked.
								</div>
							)}
						</div>
					)}
					{cfgName === "file_upload" && (
						<div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-slate-300">
							File upload not implemented. Max size:{" "}
							{typeof cfg?.max_size === "number"
								? `${cfg.max_size} bytes`
								: "unknown"}
							.
						</div>
					)}
					<div className="flex justify-end">
						<Button
							className="bg-red-600 text-white hover:bg-red-700"
							onClick={() => {
								onComplete();
								setCanSubmit(false);
							}}
							disabled={disabled || !canSubmit}
						>
							{t("submit")}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
