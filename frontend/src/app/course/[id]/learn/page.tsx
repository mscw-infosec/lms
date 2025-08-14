"use client";

import { getCourseById, getCourseTopics } from "@/api/courses";
import { type ExamDTO, type PublicTaskDTO, getTopicExams } from "@/api/exam";
import { AuthModal } from "@/components/auth-modal";
import { Header } from "@/components/header";
import { TaskPlayer } from "@/components/task-player";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/components/ui/use-toast";
import { buildTaskAnswer } from "@/features/exams/answers";
import type { UiAnswerPayload } from "@/features/exams/answers";
import { useAttempt } from "@/features/exams/useAttempt";
import { useUserStore } from "@/store/user";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	BookOpen,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	HelpCircle,
	Home,
	Menu,
	Play,
	X,
} from "lucide-react";
import { Info } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type TaskConfig = {
	name?: string;
	options?: string[];
	items?: string[];
};

export default function LearnPage() {
	const { t } = useTranslation("common");
	const { toast } = useToast();
	const params = useParams<{ id: string }>();
	const courseId = Number.parseInt(String(params.id));
	const { user } = useUserStore();
	const isStaff = user?.role === "Teacher" || user?.role === "Admin";

	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
	const [selectedExam, setSelectedExam] = useState<ExamDTO | null>(null);
	const [reviewMode, setReviewMode] = useState(false);

	const {
		attempt,
		isPreview,
		tasks,
		loading,
		taskIndex,
		setTaskIndex,
		start,
		stop,
		starting,
		stopping,
		patchProgress,
		patching,
		noMoreAttempts,
		flushNow,
		refresh,
		attemptsLeft,
		ranOut,
	} = useAttempt(selectedExam?.id ?? null, isStaff, selectedExam?.tries_count);

	// Buffer latest answer DTOs per task; submit on navigation or stop
	const latestAnswersRef = useRef<
		Record<number, ReturnType<typeof buildTaskAnswer> | null>
	>({});

	const submitBufferedForTask = (taskId: number) => {
		if (!attempt || !attempt.active) return;
		const dto = latestAnswersRef.current[taskId];
		if (dto) {
			patchProgress(dto);
		}
	};

	const submitAllBuffered = () => {
		if (!attempt || !attempt.active) return;
		const entries = Object.entries(latestAnswersRef.current);
		for (const [key, dto] of entries) {
			if (dto) patchProgress(dto);
		}
	};

	const topicsQuery = useQuery({
		queryKey: ["course-topics", courseId],
		queryFn: async () => {
			const data = await getCourseTopics(courseId);
			return data.sort((a, b) => a.order_index - b.order_index);
		},
		enabled: Number.isFinite(courseId),
		retry: false,
	});

	const examsByTopicQuery = useQuery({
		queryKey: ["topics-exams", topicsQuery.data?.map((t) => t.id) ?? []],
		queryFn: async () => {
			const topics = topicsQuery.data ?? [];
			const entries = await Promise.all(
				topics.map(async (topic) => {
					const exams = await getTopicExams(topic.id).catch(() => []);
					return [topic.id, exams as ExamDTO[]] as const;
				}),
			);
			return Object.fromEntries(entries) as Record<number, ExamDTO[]>;
		},
		enabled: topicsQuery.isSuccess,
		retry: false,
	});

	// Derived stats
	const topicsCount = (topicsQuery.data ?? []).length;
	const examsCount = Object.values(examsByTopicQuery.data ?? {}).reduce(
		(acc, arr) => acc + arr.length,
		0,
	);

	// Course info (name, description)
	const courseQuery = useQuery({
		queryKey: ["course", courseId],
		queryFn: () => getCourseById(courseId),
		enabled: Number.isFinite(courseId),
		retry: false,
	});

	const canPrev = taskIndex > 0;
	const canNext = taskIndex < (tasks.length || 0) - 1;

	const handleStart = () => {
		if (!selectedExam) return;
		setReviewMode(false);
		start();
	};

	/* biome-ignore lint/correctness/useExhaustiveDependencies: we intentionally re-run when selected exam changes */
	useEffect(() => {
		setReviewMode(false);
	}, [selectedExam?.id]);

	useEffect(() => {
		if (isStaff) {
			setReviewMode(false);
			return;
		}
		if (attempt?.active) {
			setReviewMode(false);
			return;
		}
	}, [isStaff, attempt?.active]);

	const answersByTaskId: Record<number, unknown> = (() => {
		const a = attempt?.answer_data?.answers;
		if (!a) return {};
		const out: Record<number, unknown> = {};
		for (const [k, v] of Object.entries(a)) {
			const id = Number(k);
			if (Number.isFinite(id)) out[id] = v;
		}
		return out;
	})();

	const verdictsByTaskId: Record<number, string | undefined> = (() => {
		const r = attempt?.scoring_data?.results;
		if (!r) return {};
		const out: Record<number, string> = {};
		for (const [k, v] of Object.entries(r)) {
			const id = Number(k);
			if (Number.isFinite(id) && v && typeof v.verdict === "string")
				out[id] = v.verdict;
		}
		return out;
	})();

	function renderReadOnlyTask(task: PublicTaskDTO) {
		const cfg = (task as { configuration?: TaskConfig }).configuration ?? {};
		const cfgName: string | undefined =
			typeof (cfg as TaskConfig).name === "string"
				? (cfg as TaskConfig).name
				: undefined;
		const ans = answersByTaskId[task.id];
		const verdict = verdictsByTaskId[task.id];
		const verdictLabel =
			verdict === "full_score"
				? (t("correct") ?? "Correct")
				: verdict === "partial_score"
					? (t("partially_correct") ?? "Partially correct")
					: verdict === "incorrect"
						? (t("incorrect") ?? "Incorrect")
						: verdict === "on_review"
							? (t("on_review") ?? "On review")
							: undefined;
		return (
			<Card key={task.id} className="border-slate-800 bg-slate-900">
				<CardHeader>
					<CardTitle className="text-white">
						{task.title}
						{verdictLabel ? (
							<span className="ml-2 align-middle text-slate-400 text-xs">
								{verdictLabel}
							</span>
						) : null}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{task.description ? (
						<div className="whitespace-pre-wrap text-slate-300 text-sm">
							{task.description}
						</div>
					) : null}
					<div className="text-slate-400 text-xs">
						{task.points ?? 0} {t("points") ?? "points"} · {cfgName ?? "task"}
					</div>

					{cfgName === "single_choice" &&
						Array.isArray((cfg as TaskConfig)?.options) &&
						(() => {
							const ansIdxStr = (ans as { answer?: unknown })?.answer;
							const hasAns = typeof ansIdxStr === "string" && ansIdxStr !== "";
							const correctIdxRaw = (
								task.configuration as { correct?: unknown }
							)?.correct;
							const correctIdx =
								typeof correctIdxRaw === "number" ? correctIdxRaw : undefined;
							if (!hasAns) {
								return (
									<div className="text-red-400 text-sm">
										{t("no_answer") ?? "No answer"}
									</div>
								);
							}
							const idx = Number(ansIdxStr);
							const selectedLabel =
								(cfg as TaskConfig).options?.[idx] ?? String(idx);
							const isCorrect =
								typeof correctIdx === "number" && idx === correctIdx;
							return (
								<div className="space-y-2">
									<div className="flex items-center space-x-2 opacity-90">
										<label
											className={`flex items-center gap-2 ${isCorrect ? "text-green-400" : "text-red-400"}`}
										>
											<input
												type="radio"
												disabled
												checked
												className={
													isCorrect ? "accent-green-500" : "accent-red-500"
												}
											/>
											<span>{selectedLabel}</span>
										</label>
									</div>
									{!isCorrect && typeof correctIdx === "number" ? (
										<div className="flex items-center space-x-2 opacity-70">
											<label className="flex items-center gap-2 text-green-400">
												<input
													type="radio"
													disabled
													className="accent-green-500"
												/>
												<span>
													{(cfg as TaskConfig).options?.[correctIdx] ??
														String(correctIdx)}
												</span>
											</label>
										</div>
									) : null}
								</div>
							);
						})()}
					{cfgName === "short_text" &&
						(() => {
							const val =
								typeof (ans as { answer?: unknown })?.answer === "string"
									? ((ans as { answer?: unknown })?.answer as string)
									: "";
							const tone =
								verdict === "full_score"
									? "green"
									: verdict === "incorrect"
										? "red"
										: verdict === "on_review"
											? "amber"
											: "slate";
							const border =
								tone === "green"
									? "border-green-600"
									: tone === "red"
										? "border-red-600"
										: tone === "amber"
											? "border-amber-600"
											: "border-slate-700";
							const text =
								tone === "green"
									? "text-green-300"
									: tone === "red"
										? "text-red-300"
										: tone === "amber"
											? "text-amber-300"
											: "text-white";
							return (
								<input
									type="text"
									className={`w-full rounded-lg border bg-slate-800 p-3 ${border} ${text}`}
									value={val}
									readOnly
									disabled
								/>
							);
						})()}

					{cfgName === "long_text" &&
						(() => {
							const val =
								typeof (ans as { answer?: unknown })?.answer === "string"
									? ((ans as { answer?: unknown })?.answer as string)
									: "";
							const tone =
								verdict === "full_score"
									? "green"
									: verdict === "incorrect"
										? "red"
										: verdict === "on_review"
											? "amber"
											: "slate";
							const border =
								tone === "green"
									? "border-green-600"
									: tone === "red"
										? "border-red-600"
										: tone === "amber"
											? "border-amber-600"
											: "border-slate-700";
							const text =
								tone === "green"
									? "text-green-300"
									: tone === "red"
										? "text-red-300"
										: tone === "amber"
											? "text-amber-300"
											: "text-white";
							return (
								<textarea
									className={`w-full rounded-lg border bg-slate-800 p-3 ${border} ${text}`}
									rows={5}
									value={val}
									readOnly
									disabled
								/>
							);
						})()}

					{cfgName === "multiple_choice" &&
						Array.isArray((cfg as TaskConfig)?.options) &&
						(() => {
							const raw = (ans as { answers?: unknown[] })?.answers;
							const selected = Array.isArray(raw)
								? raw.map((v) => Number(String(v)))
								: [];
							const correctRaw = (task.configuration as { correct?: unknown })
								?.correct;
							const correct = Array.isArray(correctRaw)
								? (correctRaw.filter((x) => typeof x === "number") as number[])
								: [];
							if (selected.length === 0) {
								return (
									<div className="text-red-400 text-sm">
										{t("no_answer") ?? "No answer"}
									</div>
								);
							}
							const union = Array.from(new Set([...selected, ...correct]));
							return (
								<div className="space-y-2">
									{union.map((idx, pos) => {
										const label =
											(cfg as TaskConfig).options?.[idx] ?? String(idx);
										const isSelected = selected.includes(idx);
										const isCorrect = correct.includes(idx);
										const color = isCorrect
											? "text-green-400"
											: isSelected
												? "text-red-400"
												: "text-slate-400";
										const accent = isCorrect
											? "accent-green-500"
											: isSelected
												? "accent-red-500"
												: "accent-slate-500";
										return (
											<div
												key={`${pos}-${idx}`}
												className="flex items-center space-x-2 opacity-90"
											>
												<label className={`flex items-center gap-2 ${color}`}>
													<input
														type="checkbox"
														disabled
														checked={isSelected}
														className={accent}
													/>
													<span>{label}</span>
												</label>
											</div>
										);
									})}
								</div>
							);
						})()}
					{cfgName === "ordering" &&
						Array.isArray((cfg as TaskConfig)?.items) && (
							<div className="space-y-2">
								{Array.isArray((ans as { answer?: unknown })?.answer) &&
									((ans as { answer?: unknown })?.answer as string[]).map(
										(idxStr: string, pos: number) => {
											const idx = Number(idxStr);
											const label = Array.isArray((cfg as TaskConfig).items)
												? (((cfg as TaskConfig).items as string[])[idx] ??
													String(idx))
												: String(idx);
											return (
												<div
													key={`${pos}-${idx}`}
													className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-slate-300"
												>
													{label}
												</div>
											);
										},
									)}
							</div>
						)}
					{cfgName === "file_upload" && (
						<div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-slate-300">
							{t("file_upload") ?? "File upload"}:{" "}
							{typeof (ans as { file_id?: unknown })?.file_id === "string"
								? ((ans as { file_id?: unknown })?.file_id as string)
								: (t("no_results") ?? "No results")}
						</div>
					)}
				</CardContent>
			</Card>
		);
	}

	function renderInteractiveTask(task: PublicTaskDTO) {
		const onProgress = (_questionId: number, _hasAnswer: boolean) => {
			if (!attempt || !attempt.active) return;
		};
		const onAnswer = (payload: UiAnswerPayload) => {
			if (!attempt || !attempt.active) return;
			try {
				const dto = buildTaskAnswer(task, payload);
				latestAnswersRef.current[task.id] = dto;
			} catch {
				// ignore mapping errors
			}
		};
		// Derive initial value from saved answers so inputs are hydrated after reload
		let initial: unknown = undefined;
		try {
			const cfg = (task as { configuration?: TaskConfig }).configuration ?? {};
			const cfgName: string | undefined =
				typeof (cfg as TaskConfig).name === "string"
					? (cfg as TaskConfig).name
					: undefined;
			const src = answersByTaskId[task.id] as
				| { answer?: unknown; answers?: unknown }
				| undefined;
			if (cfgName === "single_choice") {
				const v = src?.answer;
				if (typeof v === "string" || typeof v === "number") initial = String(v);
			} else if (cfgName === "multiple_choice") {
				const arr = Array.isArray(src?.answers)
					? (src?.answers as unknown[]).map((x) => Number(String(x)))
					: [];
				if (arr.length > 0) initial = arr;
			} else if (cfgName === "short_text" || cfgName === "long_text") {
				const v = src?.answer;
				if (typeof v === "string") initial = v;
			}
		} catch {
			// ignore
		}
		const isLastTask =
			tasks.length > 0 &&
			taskIndex === tasks.length - 1 &&
			tasks[taskIndex]?.id === task.id;
		return (
			<TaskPlayer
				task={task}
				previewMode={isPreview}
				disabled={false}
				isLast={isLastTask}
				initial={initial as never}
				onComplete={() => {
					submitBufferedForTask(task.id);
				}}
				onNext={() => {
					submitBufferedForTask(task.id);
					setTaskIndex(Math.min(tasks.length - 1, taskIndex + 1));
				}}
				onProgress={onProgress}
				onAnswer={onAnswer}
			/>
		);
	}

	return (
		<div className="min-h-screen bg-slate-950 text-slate-200">
			<Header
				onLogin={() => setAuthModal("login")}
				onRegister={() => setAuthModal("register")}
			/>
			<div className="flex">
				{/* Backdrop for mobile */}
				{sidebarOpen && (
					<div
						className="fixed inset-0 z-40 bg-black/50 sm:hidden"
						onClick={() => setSidebarOpen(false)}
						role="button"
						tabIndex={0}
						aria-label="Close sidebar overlay"
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								setSidebarOpen(false);
							}
						}}
					/>
				)}

				{/* Sidebar */}
				<div
					className={`${sidebarOpen ? "w-full sm:w-80" : "w-0"} overflow-hidden border-slate-800 border-r bg-slate-900 transition-all duration-300 ${sidebarOpen ? "fixed inset-0 z-50 sm:relative sm:inset-auto sm:z-auto" : ""}`}
				>
					<div className="flex items-center justify-between border-slate-800 border-b p-4">
						<h2 className="font-semibold text-white">
							{t("course_structure")}
						</h2>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setSidebarOpen(false)}
							className="text-slate-400 hover:text-white sm:hidden"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
					<div className="h-[calc(100vh-80px)] space-y-4 overflow-y-auto p-4">
						{topicsQuery.isLoading ? (
							<div className="text-slate-400 text-sm">{t("loading")}</div>
						) : null}
						{/* Button to show course info in main content */}
						<button
							type="button"
							onClick={() => setSelectedExam(null)}
							className={`flex w-full items-center rounded-lg p-2 text-left transition-colors ${
								!selectedExam
									? "bg-red-600 text-white"
									: "text-slate-300 hover:bg-slate-700"
							}`}
						>
							<div className="flex flex-1 items-center">
								<Info className="mr-2 h-4 w-4 flex-shrink-0 text-sky-400" />
								<span className="truncate text-sm">
									{t("course_info") ?? "Course info"}
								</span>
							</div>
						</button>
						{(topicsQuery.data ?? []).map((topic) => (
							<Collapsible key={topic.id} defaultOpen>
								<CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-slate-800 p-3 transition-colors hover:bg-slate-700">
									<div className="flex items-center">
										<BookOpen className="mr-2 h-4 w-4 text-slate-400" />
										<span className="font-medium text-sm text-white">
											{topic.title}
										</span>
									</div>
									<ChevronDown className="h-4 w-4 text-slate-400" />
								</CollapsibleTrigger>
								<CollapsibleContent className="mt-2 space-y-1">
									{(examsByTopicQuery.data?.[topic.id] ?? []).map((exam) => (
										<button
											type="button"
											key={exam.id}
											onClick={() => {
												setSelectedExam(exam);
												if (
													typeof window !== "undefined" &&
													window.innerWidth < 640
												)
													setSidebarOpen(false);
											}}
											className={`flex w-full items-center rounded-lg p-2 text-left transition-colors ${
												selectedExam?.id === exam.id
													? "bg-red-600 text-white"
													: "text-slate-300 hover:bg-slate-700"
											}`}
										>
											<div className="flex flex-1 items-center">
												<HelpCircle className="mr-2 h-4 w-4 flex-shrink-0 text-orange-400" />
												<span className="truncate text-sm">
													{t("exam_card", {
														type: t(
															exam.type === "Instant"
																? "exam_type_instant"
																: "exam_type_delayed",
														),
														duration: exam.duration,
														tries: exam.tries_count,
													})}
												</span>
											</div>
										</button>
									))}
								</CollapsibleContent>
							</Collapsible>
						))}
					</div>
				</div>

				{/* Main Content */}
				<div className="flex flex-1 flex-col">
					{/* Header */}
					<div className="flex items-center justify-between border-slate-800 border-b bg-slate-900 p-3 lg:p-4">
						<div className="flex min-w-0 flex-1 items-center">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setSidebarOpen(!sidebarOpen)}
								className="mr-2 flex-shrink-0 text-slate-400 hover:text-white lg:mr-4"
							>
								{sidebarOpen ? (
									<X className="h-4 w-4 lg:h-5 lg:w-5" />
								) : (
									<Menu className="h-4 w-4 lg:h-5 lg:w-5" />
								)}
							</Button>
							<Link href={`/course/${courseId}`}>
								<Button
									variant="ghost"
									size="sm"
									className="mr-2 flex-shrink-0 text-slate-400 hover:text-white lg:mr-4"
								>
									<Home className="h-4 w-4" />
								</Button>
							</Link>
							<h1 className="truncate font-semibold text-sm text-white lg:text-base">
								{selectedExam
									? t("exam")
									: (courseQuery.data?.name ?? t("course_structure"))}
							</h1>
						</div>

						{selectedExam &&
						tasks.length > 0 &&
						(isPreview || attempt?.active) &&
						!reviewMode ? (
							<div className="flex flex-shrink-0 items-center space-x-1 lg:space-x-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => setTaskIndex(Math.max(0, taskIndex - 1))}
									disabled={!canPrev}
									className="border-slate-700 bg-transparent px-2 text-slate-300 text-xs hover:bg-slate-800 lg:px-3 lg:text-sm"
								>
									<ChevronLeft className="h-3 w-3 lg:mr-1 lg:h-4 lg:w-4" />
									<span className="hidden sm:inline">{t("previous")}</span>
								</Button>

								<Button
									variant="outline"
									size="sm"
									disabled={!canNext}
									onClick={() => {
										// Submit current task before navigating via header Next
										const cur = tasks[taskIndex];
										if (cur) submitBufferedForTask(cur.id);
										setTaskIndex(Math.min(tasks.length - 1, taskIndex + 1));
									}}
									className="border-slate-700 bg-transparent px-2 text-slate-300 text-xs hover:bg-slate-800 lg:px-3 lg:text-sm"
								>
									<span className="hidden sm:inline">{t("next")}</span>
									<ChevronRight className="h-3 w-3 lg:ml-1 lg:h-4 lg:w-4" />
								</Button>

								{attempt ? (
									<Button
										variant="ghost"
										size="sm"
										onClick={async () => {
											// Best-effort submit all buffered answers, then stop attempt
											submitAllBuffered();
											await flushNow();
											stop();
											// Nudge data to refresh shortly after stop kicks off
											setTimeout(() => {
												refresh();
											}, 300);
										}}
										disabled={stopping || !attempt.active}
										className="text-red-400 hover:text-red-300"
										title={
											attempt.active
												? (t("finish") ?? "Finish")
												: (t("finished") ?? "Finished")
										}
									>
										{attempt.active
											? (t("finish") ?? "Finish")
											: (t("finished") ?? "Finished")}
									</Button>
								) : null}
							</div>
						) : null}
					</div>

					{/* Content */}
					<div className="flex-1 p-3 lg:p-6">
						{!selectedExam ? (
							<div className="space-y-4">
								<Card className="border-slate-800 bg-slate-900">
									<CardHeader>
										<CardTitle className="text-white">
											{courseQuery.data?.name ?? t("course_structure")}
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-4">
										{courseQuery.data?.description ? (
											<p className="whitespace-pre-wrap text-slate-300">
												{courseQuery.data.description}
											</p>
										) : null}
										<div className="flex flex-wrap gap-3 text-slate-300">
											<div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
												<strong className="mr-2 text-white">
													{t("topics") ?? "Topics"}:
												</strong>
												<span>{topicsCount}</span>
											</div>
											<div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
												<strong className="mr-2 text-white">
													{t("exams") ?? "Exams"}:
												</strong>
												<span>{examsCount}</span>
											</div>
										</div>
									</CardContent>
								</Card>
								<div className="text-slate-300">
									{t("select_exam") ?? "Select an exam from the left"}
								</div>
							</div>
						) : !isStaff && noMoreAttempts && !reviewMode ? (
							<Card className="border-slate-800 bg-slate-900">
								<CardContent className="space-y-3 p-6">
									<div className="text-slate-300">
										{t("no_attempts_left") ||
											"You have no attempts left for this exam."}
									</div>
									{!attempt?.active && attempt?.scoring_data?.show_results ? (
										<div className="flex items-center gap-2">
											<Button
												variant="outline"
												onClick={() => setReviewMode(true)}
												className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
											>
												{t("watch_last_attempt") ?? "Watch last attempt"}
											</Button>
										</div>
									) : null}
								</CardContent>
							</Card>
						) : !isStaff &&
							(!attempt || !attempt.active) &&
							!noMoreAttempts &&
							!reviewMode ? (
							<Card className="border-slate-800 bg-slate-900">
								<CardContent className="p-6">
									<div className="mb-3 text-slate-300">
										{t("exam_card", {
											type: t(
												selectedExam.type === "Instant"
													? "exam_type_instant"
													: "exam_type_delayed",
											),
											duration: selectedExam.duration,
											tries: selectedExam.tries_count,
										})}
									</div>
									<div className="flex items-center gap-2">
										{noMoreAttempts ? (
											<div className="text-slate-400 text-sm">
												{t("no_attempts_left") ||
													"You have no attempts left for this exam."}
											</div>
										) : (
											<Button
												onClick={handleStart}
												disabled={starting}
												className="bg-red-600 text-white hover:bg-red-700"
											>
												<Play className="mr-2 h-4 w-4" />
												{t("start_exam") ?? "Start attempt"}
											</Button>
										)}
										{!isStaff &&
										attempt &&
										!attempt.active &&
										attempt.scoring_data?.show_results ? (
											<Button
												variant="outline"
												onClick={() => setReviewMode(true)}
												className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
											>
												{t("watch_last_attempt") ?? "Watch last attempt"}
											</Button>
										) : null}
									</div>
								</CardContent>
							</Card>
						) : (
							<div className="space-y-4">
								{attempt ? (
									<div className="text-slate-400 text-xs">
										{attempt.active
											? (t("attempt_active") ?? "Attempt active")
											: (t("attempt_finished") ?? "Attempt finished")}{" "}
										· {t("started_at") ?? "Started"}:{" "}
										{new Date(attempt.started_at).toLocaleString()}
									</div>
								) : isStaff ? (
									<div className="text-slate-400 text-xs">
										{t("preview_mode") ?? "Preview mode (no attempt)"}
									</div>
								) : null}

								{!attempt?.active && attempt?.scoring_data?.show_results ? (
									<div className="flex items-center gap-2">
										{!reviewMode ? (
											<Button
												variant="outline"
												onClick={() => setReviewMode(true)}
												className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
											>
												{t("watch_last_attempt") ?? "Watch last attempt"}
											</Button>
										) : null}
									</div>
								) : null}

								{reviewMode ? (
									<div className="space-y-4">
										{tasks.length === 0 ? (
											<div className="text-slate-400 text-sm">
												{t("no_tasks_attached") ?? "No tasks attached yet."}
											</div>
										) : (
											tasks.map((tTask) => renderReadOnlyTask(tTask))
										)}
									</div>
								) : tasks.length === 0 ? (
									<div className="text-slate-400 text-sm">
										{t("no_tasks_attached") ?? "No tasks attached yet."}
									</div>
								) : (
									<>
										{attempt?.active ? (
											<div className="text-slate-400 text-sm">
												{t("pagination", {
													index: taskIndex + 1,
													total: tasks.length,
												}) || `${taskIndex + 1} / ${tasks.length}`}
											</div>
										) : null}
										{tasks[taskIndex]
											? renderInteractiveTask(tasks[taskIndex] as PublicTaskDTO)
											: null}
									</>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
			{authModal ? (
				<AuthModal type={authModal} onClose={() => setAuthModal(null)} />
			) : null}
		</div>
	);
}
