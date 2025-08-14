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
	ListChecks,
	ListOrdered,
	Type as TypeIcon,
	Upload,
} from "lucide-react";
import { useEffect, useState } from "react";

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

type AnswerValue = number | number[] | string | Record<number, number>;

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
	const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
	const [submitted, setSubmitted] = useState(false);

	const taskId = hasId(task) ? task.id : undefined;
	const interactionsLocked = disabled || submitted;
	/* biome-ignore lint/correctness/useExhaustiveDependencies: reset when taskId changes intentionally */
	useEffect(() => {
		setSubmitted(false);
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
		onProgress?.(taskId, !!value);
		const idx = Number(value);
		if (!Number.isNaN(idx)) onAnswer?.({ name: "single_choice", answer: idx });
	};
	const handleCheck = (idx: number, checked: boolean) => {
		if (interactionsLocked) return;
		const currentAnswers = Array.isArray(answers[taskId])
			? (answers[taskId] as number[])
			: [];
		const nextAnswers = checked
			? [...currentAnswers, idx]
			: currentAnswers.filter((i) => i !== idx);
		setAnswers((prev) => ({ ...prev, [taskId]: nextAnswers }));
		onProgress?.(taskId, nextAnswers.length > 0);
		onAnswer?.({ name: "multiple_choice", answers: nextAnswers });
	};
	const handleText = (val: string) => {
		if (interactionsLocked) return;
		setAnswers((prev) => ({ ...prev, [taskId]: val }));
		onProgress?.(taskId, val.trim().length > 0);

		if (cfgName === "short_text")
			onAnswer?.({ name: "short_text", answer: val });
		else if (cfgName === "long_text")
			onAnswer?.({ name: "long_text", answer: val });
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
												value={String(idx)}
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
									: undefined
							}
							onValueChange={handleRadio}
						>
							<div className="space-y-3">
								{cfg.options.map((opt: string, idx: number) => (
									<div key={opt} className="flex items-center space-x-2">
										<RadioGroupItem
											value={String(idx)}
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
								const selected: number[] = Array.isArray(answers[taskId])
									? (answers[taskId] as number[])
									: [];
								const checked = selected.includes(idx);
								return (
									<div key={opt} className="flex items-center space-x-2">
										<Checkbox
											id={`live-mc-${idx}`}
											checked={checked}
											onCheckedChange={(v) => handleCheck(idx, Boolean(v))}
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
							{cfg.items.map((it: string, idx: number) => (
								<div
									key={it}
									className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-slate-300"
								>
									{idx + 1}. {it}
								</div>
							))}
							<div className="text-slate-500 text-xs">
								Ordering interaction is not yet implemented.
							</div>
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
						{!submitted ? (
							<Button
								className="bg-red-600 text-white hover:bg-red-700"
								onClick={() => {
									onComplete();
									setSubmitted(true);
								}}
								disabled={disabled}
							>
								Submit
							</Button>
						) : (
							<Button
								variant="outline"
								disabled
								className="border-slate-800 text-slate-500"
							>
								Submitted
							</Button>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
